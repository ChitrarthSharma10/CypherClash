import { randomBytes } from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { requireTeam } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { GameSession } from '../models/GameSession.js';
import { GAMES, GAME_NAMES } from '../games/names.js';
import { gameValidators } from '../games/validators.js';
import { listRoundStates } from '../services/roundState.js';
import { ScoringError, submitGameResult } from '../services/scoring.js';
import { logEvent } from '../utils/logging.js';

const router = express.Router();
const GAME_FINISH_GRACE_MS = 2000;
const GAME_FAILURE_REASON_MAX_LENGTH = 200;
const emptyBodySchema = z.object({}).strict();
const gameInputSchema = z.object({
  type: z.string().min(1).max(32),
  timestamp: z.number().int().nonnegative(),
  idx: z.number().int().min(0).max(5).optional(),
}).strict().superRefine((input, context) => {
  if (input.type === 'toggle' && input.idx === undefined) {
    context.addIssue({ code: 'custom', message: 'Switch input requires an index', path: ['idx'] });
  }
  if (input.type !== 'toggle' && input.idx !== undefined) {
    context.addIssue({ code: 'custom', message: 'Only switch inputs may include an index', path: ['idx'] });
  }
});
const finishBodySchema = z.object({
  inputs: z.array(gameInputSchema).max(500),
}).strict();
const gameParamSchema = z.enum(GAME_NAMES);

function validateGame(req, res, next) {
  const parsed = gameParamSchema.safeParse(req.params.game);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid game' });
  }
  req.params.game = parsed.data;
  return next();
}

function getActiveRound() {
  return listRoundStates().find((round) => round.status === 'running' || round.status === 'paused');
}

function measureGameElapsed(session, roundState, now) {
  const completedPausesMs = Math.max(
    0,
    roundState.deadline.getTime() - session.deadline.getTime(),
  );
  const currentPauseMs = roundState.status === 'paused' && roundState.pausedAt
    ? Math.max(0, now.getTime() - roundState.pausedAt.getTime())
    : 0;
  return Math.max(
    0,
    now.getTime() - session.startedAt.getTime() - completedPausesMs - currentPauseMs,
  );
}

function effectiveRoundDeadline(roundState, now) {
  const currentPauseMs = roundState.status === 'paused' && roundState.pausedAt
    ? Math.max(0, now.getTime() - roundState.pausedAt.getTime())
    : 0;
  return roundState.deadline.getTime() + currentPauseMs;
}

function isWithinDeadlines(session, roundState, game, now) {
  const maxElapsedMs = GAMES[game].maxDurationSec * 1000 + GAME_FINISH_GRACE_MS;
  return now.getTime() <= effectiveRoundDeadline(roundState, now) + GAME_FINISH_GRACE_MS
    && measureGameElapsed(session, roundState, now) <= maxElapsedMs;
}

function responseError(res, status, code, error) {
  return res.status(status).json({ error, code });
}

async function expireSession(session) {
  await GameSession.updateOne(
    { _id: session._id, status: 'active' },
    { $set: { status: 'expired' } },
  );
}

router.post(
  '/:game/start',
  requireTeam,
  validateGame,
  validateBody(emptyBodySchema),
  async (req, res, next) => {
    const round = getActiveRound();
    if (
      !round
      || !['running', 'paused'].includes(round.status)
      || (round.status === 'running' && round.deadline.getTime() <= Date.now())
    ) {
      return responseError(res, 409, 'ROUND_NOT_RUNNING', 'Round is not running');
    }
    if (req.params.game === 'circuit' && round.round !== 1) {
      return responseError(res, 409, 'GAME_NOT_AVAILABLE_FOR_ROUND', 'Circuit Sync is available in Round 1');
    }

    const key = {
      teamId: req.team.teamId,
      round: round.round,
      attemptNo: round.attemptNo ?? 1,
      game: req.params.game,
    };

    try {
      const existing = await GameSession.findOne({ ...key, status: 'active' })
        .select('+seed')
        .lean();
      if (existing) {
        return res.json({
          seed: existing.seed,
          startedAt: existing.startedAt,
          deadline: existing.deadline,
          serverNow: new Date(),
        });
      }

      if (round.status !== 'running') {
        return responseError(res, 409, 'ROUND_NOT_RUNNING', 'A new game cannot start while the round is paused');
      }

      if (await GameSession.exists({ ...key, status: { $in: ['submitted', 'failed'] } })) {
        return responseError(res, 409, 'GAME_ALREADY_FINISHED', 'Game session has already finished');
      }

      const startedAt = new Date();
      const session = await GameSession.create({
        ...key,
        seed: randomBytes(32).toString('hex'),
        startedAt,
        deadline: round.deadline,
        status: 'active',
      });
      return res.json({
        seed: session.seed,
        startedAt: session.startedAt,
        deadline: session.deadline,
        serverNow: new Date(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        try {
          const existing = await GameSession.findOne({ ...key, status: 'active' })
            .select('+seed')
            .lean();
          if (existing) {
            return res.json({
              seed: existing.seed,
              startedAt: existing.startedAt,
              deadline: existing.deadline,
              serverNow: new Date(),
            });
          }
          if (await GameSession.exists({ ...key, status: { $in: ['submitted', 'failed'] } })) {
            return responseError(res, 409, 'GAME_ALREADY_FINISHED', 'Game session has already finished');
          }
        } catch (lookupError) {
          return next(lookupError);
        }
      }
      return next(error);
    }
  },
);

router.post(
  '/:game/finish',
  requireTeam,
  validateGame,
  validateBody(finishBodySchema),
  async (req, res, next) => {
    try {
      const round = getActiveRound();
      const sessionQuery = {
        teamId: req.team.teamId,
        game: req.params.game,
        status: 'active',
      };
      if (round) {
        sessionQuery.round = round.round;
        sessionQuery.attemptNo = round.attemptNo ?? 1;
      }
      const session = await GameSession.findOne(sessionQuery)
        .select('+seed')
        .sort({ startedAt: -1 });

      if (!session) {
        return responseError(res, 404, 'GAME_SESSION_NOT_FOUND', 'Active game session not found');
      }
      if (
        !round
        || round.round !== session.round
        || (round.attemptNo ?? 1) !== session.attemptNo
        || !['running', 'paused'].includes(round.status)
      ) {
        await expireSession(session);
        return responseError(res, 410, 'ROUND_NOT_ACTIVE', 'Game session round is no longer active');
      }

      const validator = gameValidators.get(req.params.game);
      if (!validator) {
        return responseError(res, 501, 'GAME_VALIDATOR_NOT_IMPLEMENTED', 'Game validation is not implemented');
      }

      const validationTime = new Date();
      const elapsedMs = measureGameElapsed(session, round, validationTime);
      if (!isWithinDeadlines(session, round, req.params.game, validationTime)) {
        await expireSession(session);
        return responseError(res, 410, 'GAME_DEADLINE_PASSED', 'Game session deadline has passed');
      }

      const validation = await validator(session.seed, req.body.inputs, elapsedMs);
      if (!validation || typeof validation.ok !== 'boolean') {
        throw new Error(`Invalid validator response for ${req.params.game}`);
      }
      if (!validation.ok) {
        if (typeof validation.reason !== 'string' || validation.reason.length === 0) {
          throw new Error(`Invalid validator reason for ${req.params.game}`);
        }
        const reason = validation.reason.slice(0, GAME_FAILURE_REASON_MAX_LENGTH);
        try {
          await logEvent({
            type: 'game validation rejected',
            actorType: 'team',
            actorId: req.team.teamId,
            teamId: req.team.teamId,
            details: { game: req.params.game, reason },
          });
        } catch (error) {
          console.error('Failed to log game validation rejection', error);
          return responseError(
            res,
            503,
            'GAME_REJECTION_LOG_FAILED',
            'Unable to record validation rejection; session remains active',
          );
        }
        const status = reason === 'not implemented' ? 501 : 422;
        return responseError(res, status, 'GAME_VALIDATION_REJECTED', reason);
      }
      if (!Number.isFinite(validation.points)) {
        throw new Error(`Invalid validator points for ${req.params.game}`);
      }

      const claimTime = new Date();
      const claimRound = getActiveRound();
      if (
        !claimRound
        || claimRound.round !== session.round
        || (claimRound.attemptNo ?? 1) !== session.attemptNo
        || !isWithinDeadlines(session, claimRound, req.params.game, claimTime)
      ) {
        await expireSession(session);
        return responseError(res, 410, 'GAME_DEADLINE_PASSED', 'Game session deadline has passed');
      }

      const claimedSession = await GameSession.findOneAndUpdate(
        {
          _id: session._id,
          teamId: req.team.teamId,
          round: session.round,
          attemptNo: session.attemptNo,
          status: 'active',
        },
        { $set: { status: 'submitted' } },
        { new: true },
      ).select('+seed');
      if (!claimedSession) {
        return responseError(res, 409, 'GAME_SESSION_NOT_ACTIVE', 'Game session is no longer active');
      }

      try {
        await submitGameResult(req.team.teamId, req.params.game, validation.points, claimedSession);
      } catch (error) {
        const reason = (error.message || 'Scoring failed').slice(0, GAME_FAILURE_REASON_MAX_LENGTH);
        try {
          const failed = await GameSession.updateOne(
            { _id: claimedSession._id, status: 'submitted' },
            { $set: { status: 'failed', failureReason: reason } },
          );
          if (failed.modifiedCount !== 1) {
            throw new Error('Could not mark failed game session');
          }
        } catch (updateError) {
          console.error('Failed to mark game session scoring failure', updateError);
          return responseError(
            res,
            500,
            'GAME_SESSION_FAILURE_UPDATE_FAILED',
            'Scoring failed and session failure state could not be recorded',
          );
        }
        try {
          await logEvent({
            type: 'game scoring failed',
            actorType: 'system',
            actorId: 'game-service',
            teamId: req.team.teamId,
            details: {
              game: req.params.game,
              round: claimedSession.round,
              attemptNo: claimedSession.attemptNo,
              reason,
            },
          });
        } catch (logError) {
          console.error('Failed to log game scoring failure', logError);
          return responseError(
            res,
            503,
            'GAME_FAILURE_LOG_FAILED',
            'Scoring failed; session marked failed, but failure could not be logged',
          );
        }
        console.error('Game result scoring failed', { game: req.params.game, reason });
        return responseError(res, 500, 'GAME_SCORING_FAILED', 'Validated game result could not be scored');
      }
      return res.json({ ok: true, points: validation.points });
    } catch (error) {
      if (error instanceof ScoringError) {
        const status = error.code === 'ROUND_NOT_RUNNING' ? 410 : 500;
        return responseError(res, status, error.code, error.message);
      }
      return next(error);
    }
  },
);

export default router;
