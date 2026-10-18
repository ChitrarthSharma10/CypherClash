import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Admin } from '../models/Admin.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { comparePassword } from '../utils/passwords.js';
import { logEvent } from '../utils/logging.js';
import { validateBody } from '../middleware/validation.js';
import { loadActivePlayer } from '../middleware/auth.js';

const router = express.Router();
export const TEAM_ID_PATTERN = /^CC-\d{3,}$/;

const playerLoginSchema = z.object({
  teamId: z.string().trim().regex(TEAM_ID_PATTERN).max(50),
  slot: z.string().trim().min(1).max(10),
  password: z.string().min(1).max(128),
}).strict();

const adminLoginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(128),
}).strict();

const emptyBodySchema = z.object({}).strict();

const playerIpLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

const playerTeamSlotLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${req.body?.teamId || ''}:${req.body?.slot || ''}`,
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

export async function clearPlayerTeamLoginLockout(teamId) {
  // Keys now include the client IP, so these legacy-shaped resets intentionally do not target active keys.
  await Promise.all([
    playerTeamSlotLoginLimiter.resetKey(`${teamId}:P1`),
    playerTeamSlotLoginLimiter.resetKey(`${teamId}:P2`),
  ]);
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
  validateBody(playerLoginSchema),
  playerIpLoginLimiter,
  playerTeamSlotLoginLimiter,
  async (req, res, next) => {
    const { teamId, slot, password } = req.body;
    try {
      const team = await Team.findOne({ teamId });
      const player = await Player.findOne({ teamId, slot }).select('+passwordHash');
      const passwordMatches = player ? await comparePassword(password, player.passwordHash) : false;

      if (!team || !player || !team.active || !passwordMatches) {
        await logEvent({
          type: 'login failure',
          actorType: 'player',
          actorId: `${teamId}:${slot}`,
          teamId,
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const now = new Date();
      await Player.updateOne({ _id: player._id }, { lastSeenAt: now, lastLoginAt: now });
      await regenerateSession(req);
      req.session.role = 'player';
      req.session.playerId = player._id.toString();
      req.session.teamId = team.teamId;
      req.session.slot = player.slot;
      await saveSession(req);
      await logEvent({ type: 'login success', actorType: 'player', actorId: player._id.toString(), teamId });

      return res.json({
        role: 'player',
        team: { teamId: team.teamId, name: team.name },
        slot: player.slot,
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/admin/login',
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

router.post('/logout', validateBody(emptyBodySchema), async (req, res, next) => {
  const actorType = req.session.role || 'anonymous';
  const actorId = req.session.playerId || req.session.adminId || 'anonymous';
  const teamId = req.session.teamId;
  try {
    if (req.session.role) {
      await logEvent({ type: 'logout', actorType, actorId, teamId });
    }
    await new Promise((resolve, reject) => req.session.destroy((error) => (error ? reject(error) : resolve())));
    res.clearCookie('connect.sid');
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get('/me', (req, res, next) => {
  if (req.session.role === 'player') {
    return loadActivePlayer(req)
      .then((result) => {
        if (!result) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        return res.json({
          role: 'player',
          teamId: result.team.teamId,
          slot: result.player.slot,
        });
      })
      .catch(next);
  }
  if (req.session.role === 'admin') {
    return res.json({ role: 'admin', username: req.session.username });
  }
  return res.status(401).json({ error: 'Authentication required' });
});

export default router;
