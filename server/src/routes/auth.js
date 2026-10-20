import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Admin } from '../models/Admin.js';
import { Team } from '../models/Team.js';
import { comparePassword, hashPassword } from '../utils/passwords.js';
import { logEvent } from '../utils/logging.js';
import { validateBody } from '../middleware/validation.js';
import { loadActiveTeam } from '../middleware/auth.js';
import { destroyTeamSessions } from '../sessionStore.js';
import { recordTeamPresence } from '../services/presence.js';

import {
  ADMIN_COOKIE_NAME,
  TEAM_COOKIE_NAME,
  adminSessionMiddleware,
  authMeSessionMiddleware,
  logoutSessionMiddleware,
  teamSessionMiddleware,
} from '../sessionMiddleware.js';

const router = express.Router();
export const TEAM_ID_PATTERN = /^CC-\d{3,}$/;

const teamLoginSchema = z.object({
  teamId: z.string().trim().regex(TEAM_ID_PATTERN).max(20),
  password: z.string().min(1).max(128),
  playerSlot: z.enum(['P1', 'P2']).optional(),
}).strict();

const adminLoginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(128),
}).strict();

const logoutBodySchema = z.object({
  role: z.enum(['admin', 'team']).optional(),
}).strict();
const emptyBodySchema = logoutBodySchema;
const DUMMY_PASSWORD_HASH = await hashPassword('invalid-team-dummy-password');

const teamLoginKeys = new Map();

function teamLoginKey(req) {
  const teamId = req.body?.teamId || '';
  if (teamId) {
    const keys = teamLoginKeys.get(teamId) || new Set();
    keys.add(`${req.ip}:${teamId}`);
    teamLoginKeys.set(teamId, keys);
  }
  return `${req.ip}:${teamId}`;
}

const teamLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: teamLoginKey,
  message: { error: 'Too many login attempts. Try again later.' },
});

const adminIpLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

const adminUsernameLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.username || ''}`,
  message: { error: 'Too many login attempts. Try again later.' },
});

const teamLoginLocks = new Map();

export async function clearTeamLoginLockout(teamId, ip) {
  if (ip) {
    await teamLoginLimiter.resetKey(`${ip}:${teamId}`);
    return;
  }
  const keys = teamLoginKeys.get(teamId);
  if (keys) {
    await Promise.all([...keys].map((key) => teamLoginLimiter.resetKey(key)));
    teamLoginKeys.delete(teamId);
  }
}

function withTeamLoginLock(teamId, operation) {
  const previous = teamLoginLocks.get(teamId) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  teamLoginLocks.set(teamId, current);
  return current.finally(() => {
    if (teamLoginLocks.get(teamId) === current) teamLoginLocks.delete(teamId);
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

router.post(
  '/login',
  teamSessionMiddleware,
  validateBody(teamLoginSchema),
  teamLoginLimiter,
  async (req, res, next) => {
    const { teamId, password } = req.body;
    try {
      const team = await Team.findOne({ teamId }).select('+passwordHash');
      const passwordMatches = await comparePassword(
        password,
        team?.passwordHash || DUMMY_PASSWORD_HASH,
      );

      if (!team || !team.active || !passwordMatches) {
        await logEvent({
          type: 'login failure',
          actorType: 'team',
          actorId: teamId,
          teamId,
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await withTeamLoginLock(team.teamId, async () => {
        await regenerateSession(req);
        const now = new Date();
        await Team.updateOne({ _id: team._id }, { $set: { lastSeenAt: now, lastLoginAt: now } });
        req.session.role = 'team';
        req.session.teamId = team.teamId;
        req.session.playerSlot = req.body.playerSlot || 'P1';
        req.session.playerId = req.session.playerSlot;
        await saveSession(req);
      });
      recordTeamPresence(team.teamId);
      await logEvent({ type: 'login success', actorType: 'team', actorId: team.teamId, teamId });

      return res.json({
        role: 'team',
        team: { teamId: team.teamId, name: team.name },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/admin/login',
  adminSessionMiddleware,
  validateBody(adminLoginSchema),
  adminIpLoginLimiter,
  adminUsernameLoginLimiter,
  async (req, res, next) => {
    const { username, password } = req.body;
    try {
      const admin = await Admin.findOne({ username }).select('+passwordHash');
      const passwordMatches = admin ? await comparePassword(password, admin.passwordHash) : false;

      if (!admin || !passwordMatches) {
        await logEvent({ type: 'login failure', actorType: 'admin', actorId: username });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      await regenerateSession(req);
      req.session.role = 'admin';
      req.session.adminId = admin._id.toString();
      req.session.username = admin.username;
      await saveSession(req);
      await logEvent({ type: 'login success', actorType: 'admin', actorId: admin._id.toString() });
      return res.json({ role: 'admin', username: admin.username });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/logout',
  logoutSessionMiddleware,
  validateBody(logoutBodySchema),
  async (req, res, next) => {
    const targetRole = req.body?.role || req.logoutTargetRole || req.session?.role;
    const actorType = req.session?.role || targetRole || 'anonymous';
    const actorId = req.session?.teamId || req.session?.adminId || 'anonymous';
    const teamId = req.session?.teamId;
    try {
      if (req.session?.role) {
        await logEvent({ type: 'logout', actorType, actorId, teamId });
      }
      if (req.session) {
        await new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
      }
      const clearOptions = { path: '/' };
      if (targetRole === 'admin' || req.session?.role === 'admin') {
        res.clearCookie(ADMIN_COOKIE_NAME, clearOptions);
      } else if (targetRole === 'team' || req.session?.role === 'team') {
        res.clearCookie(TEAM_COOKIE_NAME, clearOptions);
      } else {
        res.clearCookie(ADMIN_COOKIE_NAME, clearOptions);
        res.clearCookie(TEAM_COOKIE_NAME, clearOptions);
      }
      res.clearCookie('connect.sid', clearOptions);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/admin/logout',
  adminSessionMiddleware,
  validateBody(logoutBodySchema),
  async (req, res, next) => {
    try {
      if (req.session?.role) {
        await logEvent({ type: 'logout', actorType: 'admin', actorId: req.session.adminId || req.session.username });
      }
      if (req.session) {
        await new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
      }
      res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
      res.clearCookie('connect.sid', { path: '/' });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/team/logout',
  teamSessionMiddleware,
  validateBody(logoutBodySchema),
  async (req, res, next) => {
    try {
      if (req.session?.role) {
        await logEvent({ type: 'logout', actorType: 'team', actorId: req.session.teamId, teamId: req.session.teamId });
      }
      if (req.session) {
        await new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
      }
      res.clearCookie(TEAM_COOKIE_NAME, { path: '/' });
      res.clearCookie('connect.sid', { path: '/' });
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  },
);

router.get('/me', authMeSessionMiddleware, async (req, res, next) => {
  if (req.session?.role === 'team') {
    return loadActiveTeam(req)
      .then((team) => {
        if (!team) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        return res.json({ role: 'team', teamId: team.teamId });
      })
      .catch(next);
  }
  if (req.session?.role === 'admin') {
    return res.json({ role: 'admin', username: req.session.username });
  }
  return res.status(401).json({ error: 'Authentication required' });
});

export default router;
