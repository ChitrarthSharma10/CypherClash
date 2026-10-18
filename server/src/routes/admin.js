import express from 'express';
import { z } from 'zod';
import { Admin } from '../models/Admin.js';
import { EventLog } from '../models/EventLog.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { generatePassword, hashPassword } from '../utils/passwords.js';
import { logEvent } from '../utils/logging.js';
import { destroyPlayerSessions } from '../sessionStore.js';
import { clearPlayerTeamLoginLockout, TEAM_ID_PATTERN } from './auth.js';

const router = express.Router();
router.use(requireAdmin);
router.param('teamId', (req, res, next, teamId) => {
  if (!TEAM_ID_PATTERN.test(teamId)) {
    return res.status(400).json({ error: 'Invalid team ID' });
  }
  return next();
});

const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
  biasPoints: z.number().finite().min(-1000).max(100000).default(0),
}).strict();

const updateTeamSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  biasPoints: z.number().finite().min(-1000).max(100000).optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const slotSchema = z.object({ slot: z.enum(['P1', 'P2']) }).strict();
const emptyBodySchema = z.object({}).strict();

async function nextTeamId() {
  const latest = await Team.findOne().sort({ teamId: -1 }).select('teamId').lean();
  const nextNumber = latest ? Number(latest.teamId.slice(3)) + 1 : 1;
  return `CC-${String(nextNumber).padStart(3, '0')}`;
}

function playerView(player) {
  return {
    slot: player.slot,
    online: Boolean(player.lastSeenAt && Date.now() - player.lastSeenAt.getTime() <= 45_000),
    lastLoginAt: player.lastLoginAt,
  };
}

router.post('/teams', validateBody(createTeamSchema), async (req, res, next) => {
  let team;
  const createdPlayerIds = [];
  try {
    const teamId = await nextTeamId();
    const passwords = {
      P1: generatePassword(),
      P2: generatePassword(),
    };
    const passwordHashes = {
      P1: await hashPassword(passwords.P1),
      P2: await hashPassword(passwords.P2),
    };
    team = await Team.create({ teamId, name: req.body.name, biasPoints: req.body.biasPoints });
    const credentials = {};
    for (const slot of ['P1', 'P2']) {
      const player = await Player.create({
        team: team._id,
        teamId,
        slot,
        passwordHash: passwordHashes[slot],
      });
      createdPlayerIds.push(player._id);
      credentials[slot] = passwords[slot];
    }
    await logEvent({
      type: 'team created',
      actorType: 'admin',
      actorId: req.session.adminId,
      teamId,
      details: { name: team.name },
    });
    return res.status(201).json({
      team: { teamId: team.teamId, name: team.name, biasPoints: team.biasPoints, active: team.active },
      credentials,
    });
  } catch (error) {
    try {
      await Player.deleteMany({
        _id: { $in: createdPlayerIds },
      });
      if (team) {
        await Team.deleteOne({ _id: team._id });
      }
    } catch (rollbackError) {
      console.error('Failed to roll back team creation', rollbackError);
    }
    return next(error);
  }
});

router.get('/teams', async (req, res, next) => {
  try {
    const [teams, players] = await Promise.all([
      Team.find().sort({ teamId: 1 }).lean(),
      Player.find().select('teamId slot lastSeenAt lastLoginAt').lean(),
    ]);
    return res.json(teams.map((team) => ({
      ...team,
      players: players.filter((player) => player.teamId === team.teamId).map(playerView),
    })));
  } catch (error) {
    return next(error);
  }
});

router.patch('/teams/:teamId', validateBody(updateTeamSchema), async (req, res, next) => {
  try {
    const previousTeam = await Team.findOne({ teamId: req.params.teamId }).lean();
    if (!previousTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const team = await Team.findOneAndUpdate(
      { teamId: req.params.teamId },
      { $set: req.body },
      { new: true, runValidators: true },
    ).lean();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (req.body.active !== undefined && req.body.active !== previousTeam.active) {
      await logEvent({
        type: req.body.active ? 'team enabled' : 'team disabled',
        actorType: 'admin',
        actorId: req.session.adminId,
        teamId: team.teamId,
      });
    }
    if (req.body.name !== undefined && req.body.name !== previousTeam.name) {
      await logEvent({
        type: 'team name edited',
        actorType: 'admin',
        actorId: req.session.adminId,
        teamId: team.teamId,
        details: { oldName: previousTeam.name, newName: team.name },
      });
    }
    if (req.body.biasPoints !== undefined && req.body.biasPoints !== previousTeam.biasPoints) {
      await logEvent({
        type: 'bias points changed',
        actorType: 'admin',
        actorId: req.session.adminId,
        teamId: team.teamId,
        details: { oldValue: previousTeam.biasPoints, newValue: team.biasPoints },
      });
    }
    if (req.body.active === false) {
      const players = await Player.find({ teamId: team.teamId }).select('_id').lean();
      await Promise.all(players.map((player) => destroyPlayerSessions(player._id.toString())));
    }
    return res.json({ team });
  } catch (error) {
    return next(error);
  }
});

router.post('/teams/:teamId/reset-password', validateBody(slotSchema), async (req, res, next) => {
  try {
    const player = await Player.findOne({ teamId: req.params.teamId, slot: req.body.slot });
    if (!player) {
      return res.status(404).json({ error: 'Team or player not found' });
    }
    const password = generatePassword();
    player.passwordHash = await hashPassword(password);
    await player.save();
    await destroyPlayerSessions(player._id.toString());
    await logEvent({
      type: 'password reset',
      actorType: 'admin',
      actorId: req.session.adminId,
      teamId: req.params.teamId,
      details: { slot: req.body.slot },
    });
    return res.json({ teamId: req.params.teamId, slot: req.body.slot, password });
  } catch (error) {
    return next(error);
  }
});

router.post('/teams/:teamId/clear-login-lockout', validateBody(emptyBodySchema), async (req, res, next) => {
  try {
    const team = await Team.exists({ teamId: req.params.teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    await clearPlayerTeamLoginLockout(req.params.teamId);
    await logEvent({
      type: 'login lockout cleared',
      actorType: 'admin',
      actorId: req.session.adminId,
      teamId: req.params.teamId,
    });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const logs = await EventLog.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json(logs);
  } catch (error) {
    return next(error);
  }
});

export default router;
