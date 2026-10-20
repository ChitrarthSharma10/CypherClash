import express from 'express';
import { z } from 'zod';
import { EventLog } from '../models/EventLog.js';
import { Team } from '../models/Team.js';
import { TeamProgression } from '../models/TeamProgression.js';
import { GameSession } from '../models/GameSession.js';
import { ScoreEntry } from '../models/ScoreEntry.js';
import { RoundState } from '../models/RoundState.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { generatePassword, hashPassword } from '../utils/passwords.js';
import { logEvent } from '../utils/logging.js';
import { destroyTeamSessions } from '../sessionStore.js';
import { clearTeamLoginLockout, TEAM_ID_PATTERN } from './auth.js';
import {
  endRound,
  listRoundStates,
  pauseRound,
  resumeRound,
  startRound,
} from '../services/roundState.js';
import { addAdjustment, getAllTotals } from '../services/scoring.js';
import { isTeamOnline } from '../services/presence.js';
import { invalidateLeaderboard } from '../services/leaderboard.js';
import {
  advanceTeamProgression,
  getEffectiveProgression,
  getOrCreateProgression,
  revertProgressionOverride,
  setRoundStatus,
} from '../services/progression.js';

import { TOTAL_ROUNDS } from '../../../shared/rounds.js';

const router = express.Router();
router.use(requireAdmin);
router.param('teamId', (req, res, next, teamId) => {
  if (!TEAM_ID_PATTERN.test(teamId)) {
    return res.status(400).json({ error: 'Invalid team ID' });
  }
  return next();
});
router.param('n', (req, res, next, value) => {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > TOTAL_ROUNDS) {
    return res.status(400).json({ error: 'Invalid round number' });
  }
  req.roundNumber = Number(value);
  return next();
});

const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
  biasPoints: z.number().finite().min(-1000).max(100000).default(0),
  initialProgression: z.number().int().min(1).max(TOTAL_ROUNDS).default(1),
}).strict();

const updateTeamSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  biasPoints: z.number().finite().min(-1000).max(100000).optional(),
  active: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const emptyBodySchema = z.object({}).strict();
const startRoundSchema = z.object({
  durationSec: z.number().int().min(1).max(86400),
}).strict();
const adjustmentSchema = z.object({
  round: z.number().int().min(1).max(TOTAL_ROUNDS),
  amount: z.number().int().min(-1000).max(1000),
  reason: z.string().trim().min(1).max(200),
}).strict();

const advanceProgressionSchema = z.object({
  targetRound: z.number().int().min(1).max(TOTAL_ROUNDS),
  waivePrior: z.boolean().default(true),
  reason: z.string().trim().min(3).max(500),
}).strict();

const waiveProgressionSchema = z.object({
  round: z.number().int().min(1).max(TOTAL_ROUNDS),
  status: z.enum(['waived', 'pending', 'completed_normally']),
  reason: z.string().trim().min(3).max(500),
}).strict();

const revertProgressionSchema = z.object({
  confirmDisruptive: z.boolean().default(false),
  reason: z.string().trim().min(3).max(500),
}).strict();

async function nextTeamId() {
  const latest = await Team.findOne().sort({ teamId: -1 }).select('teamId').lean();
  const nextNumber = latest ? Number(latest.teamId.slice(3)) + 1 : 1;
  return `CC-${String(nextNumber).padStart(3, '0')}`;
}

function serviceErrorStatus(error) {
  if (error.code === 'TEAM_NOT_FOUND') return 404;
  if ([
    'RESULT_ALREADY_SUBMITTED',
    'ROUND_ALREADY_STARTED',
    'ROUND_NOT_RUNNING',
    'ROUND_NOT_PAUSED',
    'ROUND_NOT_ACTIVE',
    'NO_COMPLETION_EVIDENCE',
    'ROUND_STATE_CHANGED',
    'MULTIPLE_ACTIVE_ROUNDS',
  ].includes(error.code)) return 409;
  if ([
    'INVALID_ADJUSTMENT',
    'INVALID_GAME',
    'INVALID_POINTS',
    'INVALID_TARGET_ROUND',
    'INVALID_ROUND',
    'INVALID_STATUS',
    'REASON_REQUIRED',
  ].includes(error.code)) {
    return 400;
  }
  return 500;
}

router.post('/rounds/:n/start', validateBody(startRoundSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await startRound(req.roundNumber, req.body.durationSec, req.session.adminId));
  } catch (error) {
    if (serviceErrorStatus(error) !== 500) {
      return res.status(serviceErrorStatus(error)).json({ error: error.message });
    }
    return next(error);
  }
});

router.post('/rounds/:n/pause', validateBody(emptyBodySchema), async (req, res, next) => {
  try {
    return res.json(await pauseRound(req.roundNumber, req.session.adminId));
  } catch (error) {
    if (serviceErrorStatus(error) !== 500) {
      return res.status(serviceErrorStatus(error)).json({ error: error.message });
    }
    return next(error);
  }
});

router.post('/rounds/:n/resume', validateBody(emptyBodySchema), async (req, res, next) => {
  try {
    return res.json(await resumeRound(req.roundNumber, req.session.adminId));
  } catch (error) {
    if (serviceErrorStatus(error) !== 500) {
      return res.status(serviceErrorStatus(error)).json({ error: error.message });
    }
    return next(error);
  }
});

router.post('/rounds/:n/end', validateBody(emptyBodySchema), async (req, res, next) => {
  try {
    return res.json(await endRound(req.roundNumber, req.session.adminId));
  } catch (error) {
    if (serviceErrorStatus(error) !== 500) {
      return res.status(serviceErrorStatus(error)).json({ error: error.message });
    }
    return next(error);
  }
});

router.get('/rounds', (req, res) => res.json(listRoundStates()));

router.post('/teams/:teamId/adjust', validateBody(adjustmentSchema), async (req, res, next) => {
  try {
    const before = await getAllTotals();
    const entry = await addAdjustment(
      req.params.teamId,
      req.body.round,
      req.body.amount,
      req.body.reason,
      req.session.adminId,
    );
    const after = await getAllTotals();
    await logEvent({
      type: 'score adjustment',
      actorType: 'admin',
      actorId: req.session.adminId,
      teamId: req.params.teamId,
      details: { old: before.find((item) => item.teamId === req.params.teamId) || { teamId: req.params.teamId, total: 0, rounds: {} }, new: after.find((item) => item.teamId === req.params.teamId), entryId: entry._id.toString() },
    });
    return res.status(201).json(entry);
  } catch (error) {
    if (serviceErrorStatus(error) !== 500) {
      return res.status(serviceErrorStatus(error)).json({ error: error.message });
    }
    return next(error);
  }
});

router.get('/scores', async (req, res, next) => {
  try {
    return res.json(await getAllTotals());
  } catch (error) {
    return next(error);
  }
});

router.get('/investigation/final-results', async (req, res, next) => {
  try {
    const round = await RoundState.findOne({ round: 3 }).lean();
    const cases = (round?.investigations || [])
      .filter(({ finalResult }) => finalResult)
      .sort(
        (first, second) =>
          new Date(first.finalResult.roundEndedAt) -
            new Date(second.finalResult.roundEndedAt) ||
          first.teamId.localeCompare(second.teamId),
      );
    return res.json(
      cases.map(({ teamId, round: caseRound, attemptNo, finalResult }) => ({
        teamId,
        round: caseRound,
        attemptNo,
        ...finalResult,
      })),
    );
  } catch (error) {
    return next(error);
  }
});

router.post('/teams', validateBody(createTeamSchema), async (req, res, next) => {
  let team;
  try {
    const teamId = await nextTeamId();
    const password = generatePassword(12);
    const passwordHash = await hashPassword(password);
    team = await Team.create({
      teamId,
      name: req.body.name,
      biasPoints: req.body.biasPoints,
      passwordHash,
    });
    const initialProgression = req.body.initialProgression || 1;
    await getOrCreateProgression(teamId, initialProgression, req.session.adminId);
    await logEvent({
      type: 'team created',
      actorType: 'admin',
      actorId: req.session.adminId,
      teamId,
      details: { name: team.name, initialProgression },
    });
    invalidateLeaderboard();
    res.set('Cache-Control', 'no-store');
    return res.status(201).json({
      team: {
        teamId: team.teamId,
        name: team.name,
        biasPoints: team.biasPoints,
        active: team.active,
        initialProgression,
      },
      password,
    });
  } catch (error) {
    try {
      if (team) {
        await Team.deleteOne({ _id: team._id });
        await TeamProgression.deleteOne({ teamId: team.teamId });
      }
    } catch (rollbackError) {
      console.error('Failed to roll back team creation', rollbackError);
    }
    return next(error);
  }
});

router.get('/teams', async (req, res, next) => {
  try {
    const teams = await Team.find().sort({ teamId: 1 }).lean();
    const progressions = await TeamProgression.find().lean();
    const progressionMap = new Map(progressions.map((p) => [p.teamId, p]));

    return res.json(
      teams.map((team) => {
        const prog = progressionMap.get(team.teamId);
        return {
          ...team,
          online: isTeamOnline(team.teamId),
          progression: {
            maxEligibleRound: prog?.maxEligibleRound || 1,
            initialRound: prog?.initialRound || 1,
            waivedRounds: prog?.waivedRounds || [],
          },
        };
      }),
    );
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
    const teamChanged = (
      (req.body.name !== undefined && req.body.name !== previousTeam.name)
      || (req.body.biasPoints !== undefined && req.body.biasPoints !== previousTeam.biasPoints)
      || (req.body.active !== undefined && req.body.active !== previousTeam.active)
    );
    if (teamChanged) invalidateLeaderboard();
    if (req.body.active === false && previousTeam.active) {
      await destroyTeamSessions(team.teamId);
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
    return res.json({ team });
  } catch (error) {
    return next(error);
  }
});

router.post('/teams/:teamId/reset-password', validateBody(emptyBodySchema), async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const password = generatePassword(12);
    const passwordHash = await hashPassword(password);
    const team = await Team.findOneAndUpdate(
      { teamId: req.params.teamId },
      { $set: { passwordHash } },
      { new: true, runValidators: true },
    ).select('teamId').lean();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    await destroyTeamSessions(team.teamId);
    await clearTeamLoginLockout(team.teamId);
    await logEvent({
      type: 'password reset',
      actorType: 'admin',
      actorId: req.session.adminId,
      teamId: req.params.teamId,
    });
    return res.json({ teamId: req.params.teamId, password });
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
    await clearTeamLoginLockout(req.params.teamId);
    await destroyTeamSessions(req.params.teamId);
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

router.get('/teams/:teamId/progression', async (req, res, next) => {
  try {
    const team = await Team.findOne({ teamId: req.params.teamId }).lean();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const progression = await getEffectiveProgression(req.params.teamId);
    const sessions = await GameSession.find({ teamId: req.params.teamId })
      .select('round attemptNo game status startedAt deadline progress')
      .sort({ round: 1, attemptNo: 1 })
      .lean();
    const scoreEntries = await ScoreEntry.find({ teamId: req.params.teamId })
      .select('round attemptNo game kind amount reason createdAt')
      .sort({ round: 1, attemptNo: 1 })
      .lean();

    return res.json({
      team: { teamId: team.teamId, name: team.name },
      progression,
      sessions,
      scoreEntries,
      globalRounds: listRoundStates(),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/teams/:teamId/progression/advance', validateBody(advanceProgressionSchema), async (req, res, next) => {
  try {
    const team = await Team.exists({ teamId: req.params.teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const result = await advanceTeamProgression(req.params.teamId, {
      targetRound: req.body.targetRound,
      waivePriorRounds: req.body.waivePrior,
      reason: req.body.reason,
      adminId: req.session.adminId,
    });
    return res.json(result);
  } catch (error) {
    if (serviceErrorStatus(error) !== 500) {
      return res.status(serviceErrorStatus(error)).json({ error: error.message, code: error.code });
    }
    return next(error);
  }
});

router.post('/teams/:teamId/progression/waive', validateBody(waiveProgressionSchema), async (req, res, next) => {
  try {
    const team = await Team.exists({ teamId: req.params.teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const result = await setRoundStatus(req.params.teamId, {
      roundNumber: req.body.round,
      status: req.body.status,
      reason: req.body.reason,
      adminId: req.session.adminId,
    });
    return res.json(result);
  } catch (error) {
    if (serviceErrorStatus(error) !== 500) {
      return res.status(serviceErrorStatus(error)).json({ error: error.message, code: error.code });
    }
    return next(error);
  }
});

router.post('/teams/:teamId/progression/revert', validateBody(revertProgressionSchema), async (req, res, next) => {
  try {
    const team = await Team.exists({ teamId: req.params.teamId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    const result = await revertProgressionOverride(req.params.teamId, {
      confirmDisruptive: req.body.confirmDisruptive,
      reason: req.body.reason,
      adminId: req.session.adminId,
    });
    return res.json(result);
  } catch (error) {
    if (serviceErrorStatus(error) !== 500) {
      return res.status(serviceErrorStatus(error)).json({ error: error.message, code: error.code });
    }
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
