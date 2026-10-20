import { randomBytes } from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { requireTeam } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { GameSession } from '../models/GameSession.js';
import { ScoreEntry } from '../models/ScoreEntry.js';
import { HintEntitlement } from '../models/HintEntitlement.js';
import { GAMES } from '../games/names.js';
import {
  calculateInvestigationPoints,
  getPublicInvestigationClues,
  RESOURCE_CONTENTS,
  STAGE_HINTS,
  TOTAL_STAGES,
  validateClueSubmission,
} from '../games/investigation.js';
import { getRoundState, listRoundStates } from '../services/roundState.js';
import { submitGameResult } from '../services/scoring.js';
import { isTeamEligibleForRound } from '../services/progression.js';
import { config } from '../config.js';
import { logEvent } from '../utils/logging.js';

const router = express.Router();
const GAME_FINISH_GRACE_MS = 2000;
const emptyBodySchema = z.object({}).strict();

const submitClueSchema = z.object({
  stage: z.number().int().min(1).max(TOTAL_STAGES),
  answer: z.string().trim().min(1).max(200),
}).strict();

const hintSchema = z.object({
  stage: z.number().int().min(1).max(TOTAL_STAGES),
}).strict();

function getRound2State() {
  const round = getRoundState(2);
  if (round) return round;
  const fromList = listRoundStates().find((item) => item.round === 2);
  return fromList || null;
}

function measureElapsedMs(session, roundState, now) {
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

function isWithinDeadlines(session, roundState, now) {
  if (roundState.status === 'ended') return false;
  const maxElapsedMs = GAMES.investigation.maxDurationSec * 1000 + GAME_FINISH_GRACE_MS;
  const currentPauseMs = roundState.status === 'paused' && roundState.pausedAt
    ? Math.max(0, now.getTime() - roundState.pausedAt.getTime())
    : 0;
  const effectiveDeadline = roundState.deadline.getTime() + currentPauseMs + GAME_FINISH_GRACE_MS;
  return now.getTime() <= effectiveDeadline && measureElapsedMs(session, roundState, now) <= maxElapsedMs;
}

/**
 * GET /api/rounds/2/investigation/state
 * Retrieves the current team's private investigation state.
 */
router.get('/state', requireTeam, async (req, res, next) => {
  try {
    const roundState = getRound2State();
    if (!roundState || roundState.status === 'not_started') {
      return res.json({
        ok: true,
        status: 'locked',
        reason: 'Round 2 has not started yet',
        round: roundState,
      });
    }

    const isEligible = await isTeamEligibleForRound(req.team.teamId, 2);
    if (!isEligible) {
      return res.json({
        ok: true,
        status: 'prerequisite_required',
        reason: 'Progression prerequisite not met: Round 1 must be completed or waived by administrator',
        code: 'PROGRESSION_PREREQUISITE_NOT_MET',
        round: roundState,
      });
    }

    const session = await GameSession.findOne({
      teamId: req.team.teamId,
      round: 2,
      attemptNo: roundState.attemptNo ?? 1,
      game: 'investigation',
    }).lean();

    if (!session) {
      if (roundState.status === 'ended') {
        return res.json({
          ok: true,
          status: 'ended',
          reason: 'Round 2 has ended',
          round: roundState,
        });
      }
      return res.json({
        ok: true,
        status: 'not_started',
        round: roundState,
      });
    }

    const now = new Date();
    if (session.status === 'active' && !isWithinDeadlines(session, roundState, now)) {
      await GameSession.updateOne(
        { _id: session._id, status: 'active' },
        { $set: { status: 'expired' } },
      );
      session.status = 'expired';
    }

    const isCompleted = session.status === 'submitted';
    const currentStage = session.progress?.stage || 1;
    const clues = getPublicInvestigationClues(currentStage, isCompleted);
    const wrongAttempts = session.progress?.wrongAttempts || 0;

    const entitlement = await HintEntitlement.findOne({
      teamId: req.team.teamId,
      round: 2,
    }).lean();
    const hintsUsed = Math.max(session.progress?.hintsUsed || 0, entitlement?.hintsUsed || 0);
    const revealedHint = session.progress?.revealedHint
      || (entitlement?.hintDetails ? {
        stage: entitlement.hintDetails.stage,
        text: STAGE_HINTS[entitlement.hintDetails.stage],
        unlockedAt: entitlement.hintDetails.unlockedAt,
      } : null);

    return res.json({
      ok: true,
      status: session.status,
      round: roundState,
      session: {
        stage: currentStage,
        totalStages: TOTAL_STAGES,
        wrongAttempts,
        hintsUsed,
        revealedHint,
        startedAt: session.startedAt,
        deadline: session.deadline,
        completedAt: session.progress?.completedAt || null,
        elapsedMs: measureElapsedMs(session, roundState, now),
        score: isCompleted ? calculateInvestigationPoints({ wrongAttempts, hintsUsed }) : null,
      },
      clues,
      serverNow: new Date(),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/rounds/2/investigation/resources/:slug
 * Authenticated resource access route.
 * Strictly prevents direct navigation to future stages before unlocking them.
 */
router.get('/resources/:slug', requireTeam, async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const resource = RESOURCE_CONTENTS[slug];
    if (!resource) {
      return res.status(404).json({ error: 'Investigation resource not found', code: 'RESOURCE_NOT_FOUND' });
    }

    const roundState = getRound2State();
    if (!roundState || roundState.status === 'not_started') {
      return res.status(403).json({
        error: 'Round 2 is not currently active',
        code: 'ROUND_NOT_ACTIVE',
      });
    }

    if (!(await isTeamEligibleForRound(req.team.teamId, 2))) {
      return res.status(403).json({
        error: 'Team does not meet the progression prerequisites for Round 2',
        code: 'PROGRESSION_PREREQUISITE_NOT_MET',
      });
    }

    const session = await GameSession.findOne({
      teamId: req.team.teamId,
      round: 2,
      attemptNo: roundState.attemptNo ?? 1,
      game: 'investigation',
    }).lean();

    if (!session) {
      return res.status(403).json({
        error: 'Investigation session not started. Begin the investigation first.',
        code: 'SESSION_NOT_STARTED',
      });
    }

    if (session.status === 'expired') {
      return res.status(403).json({
        error: 'Investigation session has expired.',
        code: 'SESSION_EXPIRED',
      });
    }

    // Solved or currently active stage access check
    const currentStage = session.status === 'submitted' ? TOTAL_STAGES + 1 : (session.progress?.stage || 1);
    if (resource.stage > currentStage) {
      return res.status(403).json({
        error: `Resource locked. Complete Lead 0${resource.stage - 1} to unlock this resource.`,
        code: 'RESOURCE_LOCKED',
        currentStage,
        requiredStage: resource.stage,
      });
    }

    return res.json({
      ok: true,
      slug,
      brand: resource.brand,
      title: resource.title,
      stage: resource.stage,
      html: resource.html,
      githubUrl: slug === 'terminal' ? (config.investigationLead3GithubUrl || null) : undefined,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/rounds/2/investigation/start
 * Starts or retrieves the team's active investigation session. Idempotent.
 */
router.post('/start', requireTeam, validateBody(emptyBodySchema), async (req, res, next) => {
  try {
    const roundState = getRound2State();
    if (!roundState || !['running', 'paused'].includes(roundState.status)) {
      return res.status(409).json({
        error: 'Round 2 is not currently running',
        code: 'ROUND_NOT_RUNNING',
      });
    }
    if (roundState.status === 'running' && roundState.deadline?.getTime() <= Date.now()) {
      return res.status(409).json({
        error: 'Round 2 deadline has expired',
        code: 'ROUND_NOT_RUNNING',
      });
    }

    if (!(await isTeamEligibleForRound(req.team.teamId, 2))) {
      return res.status(403).json({
        error: 'Team does not meet the progression prerequisites for Round 2',
        code: 'PROGRESSION_PREREQUISITE_NOT_MET',
      });
    }

    const key = {
      teamId: req.team.teamId,
      round: 2,
      attemptNo: roundState.attemptNo ?? 1,
      game: 'investigation',
    };

    const existing = await GameSession.findOne(key);
    if (existing) {
      if (existing.status === 'active') {
        const now = new Date();
        if (!isWithinDeadlines(existing, roundState, now)) {
          existing.status = 'expired';
          await existing.save();
          return res.status(410).json({
            error: 'Round 2 deadline has passed',
            code: 'GAME_DEADLINE_PASSED',
          });
        }
        return res.json({
          ok: true,
          status: 'active',
          startedAt: existing.startedAt,
          deadline: existing.deadline,
          stage: existing.progress?.stage || 1,
          serverNow: new Date(),
        });
      }
      if (existing.status === 'submitted') {
        return res.json({
          ok: true,
          status: 'submitted',
          startedAt: existing.startedAt,
          deadline: existing.deadline,
          stage: TOTAL_STAGES,
          serverNow: new Date(),
        });
      }
      return res.status(409).json({
        error: 'Game session has already finished',
        code: 'GAME_ALREADY_FINISHED',
      });
    }

    if (roundState.status !== 'running') {
      return res.status(409).json({
        error: 'A new game session cannot be started while the round is paused',
        code: 'ROUND_NOT_RUNNING',
      });
    }

    const startedAt = new Date();
    try {
      const session = await GameSession.create({
        ...key,
        seed: randomBytes(32).toString('hex'),
        startedAt,
        deadline: roundState.deadline,
        status: 'active',
        progress: {
          stage: 1,
          wrongAttempts: 0,
          hintsUsed: 0,
        },
      });

      await logEvent({
        type: 'investigation started',
        actorType: 'team',
        actorId: req.team.teamId,
        teamId: req.team.teamId,
        details: { round: 2, attemptNo: key.attemptNo },
      });

      return res.json({
        ok: true,
        status: 'active',
        startedAt: session.startedAt,
        deadline: session.deadline,
        stage: 1,
        serverNow: new Date(),
      });
    } catch (createError) {
      if (createError?.code === 11000) {
        const raceExisting = await GameSession.findOne(key);
        if (raceExisting && raceExisting.status === 'active') {
          return res.json({
            ok: true,
            status: 'active',
            startedAt: raceExisting.startedAt,
            deadline: raceExisting.deadline,
            stage: raceExisting.progress?.stage || 1,
            serverNow: new Date(),
          });
        }
        return res.status(409).json({
          error: 'Game session has already finished',
          code: 'GAME_ALREADY_FINISHED',
        });
      }
      throw createError;
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/rounds/2/investigation/submit
 * Validates a clue answer or final flag submission.
 * Atomically transitions to submitted on Stage 4 and records the score into ScoreEntry ledger.
 */
router.post('/submit', requireTeam, validateBody(submitClueSchema), async (req, res, next) => {
  try {
    const roundState = getRound2State();
    if (!roundState || !['running', 'paused'].includes(roundState.status)) {
      return res.status(409).json({
        error: 'Round 2 is not currently active',
        code: 'ROUND_NOT_ACTIVE',
      });
    }

    const session = await GameSession.findOne({
      teamId: req.team.teamId,
      round: 2,
      attemptNo: roundState.attemptNo ?? 1,
      game: 'investigation',
      status: 'active',
    });

    if (!session) {
      const existingSubmitted = await GameSession.exists({
        teamId: req.team.teamId,
        round: 2,
        attemptNo: roundState.attemptNo ?? 1,
        game: 'investigation',
        status: 'submitted',
      });
      if (existingSubmitted) {
        return res.status(409).json({
          error: 'Investigation has already been submitted and scored',
          code: 'GAME_ALREADY_FINISHED',
        });
      }
      return res.status(404).json({
        error: 'Active investigation session not found',
        code: 'GAME_SESSION_NOT_FOUND',
      });
    }

    const now = new Date();
    if (!isWithinDeadlines(session, roundState, now)) {
      session.status = 'expired';
      await session.save();
      return res.status(410).json({
        error: 'Round or session deadline has expired',
        code: 'GAME_DEADLINE_PASSED',
      });
    }

    const { stage, answer } = req.body;
    const currentStage = session.progress?.stage || 1;

    if (stage !== currentStage) {
      return res.status(400).json({
        error: `Submission is for stage ${stage}, but current active stage is ${currentStage}`,
        code: 'STAGE_MISMATCH',
        currentStage,
      });
    }

    const validation = validateClueSubmission(stage, answer);

    if (!validation.ok) {
      session.progress = session.progress || {};
      session.progress.wrongAttempts = (session.progress.wrongAttempts || 0) + 1;
      session.markModified('progress');
      await session.save();

      await logEvent({
        type: 'investigation clue rejected',
        actorType: 'team',
        actorId: req.team.teamId,
        teamId: req.team.teamId,
        details: { stage, reason: validation.error },
      });

      return res.status(422).json({
        ok: false,
        error: validation.error,
        code: 'INVALID_CLUE_ANSWER',
        stage,
        wrongAttempts: session.progress.wrongAttempts,
      });
    }

    // Correct answer for stages 1 to 3
    if (stage < TOTAL_STAGES) {
      const nextStage = stage + 1;
      session.progress = session.progress || {};
      session.progress.stage = nextStage;
      session.markModified('progress');
      await session.save();

      await logEvent({
        type: 'investigation clue solved',
        actorType: 'team',
        actorId: req.team.teamId,
        teamId: req.team.teamId,
        details: { stage, nextStage },
      });

      return res.json({
        ok: true,
        stage: nextStage,
        message: 'Lead verified! Next investigation resource unlocked.',
        clues: getPublicInvestigationClues(nextStage, false),
      });
    }

    // Final Stage 4 Solved!
    const wrongAttempts = session.progress?.wrongAttempts || 0;
    const entitlement = await HintEntitlement.findOne({
      teamId: req.team.teamId,
      round: 2,
    }).lean();
    const hintsUsed = Math.max(session.progress?.hintsUsed || 0, entitlement?.hintsUsed || 0);
    const points = calculateInvestigationPoints({
      elapsedMs: measureElapsedMs(session, roundState, now),
      wrongAttempts,
      hintsUsed,
    });

    // Atomic update from active to submitted prevents concurrent duplicate scoring
    const updated = await GameSession.findOneAndUpdate(
      {
        _id: session._id,
        status: 'active',
      },
      {
        $set: {
          status: 'submitted',
          'progress.completedAt': new Date(),
        },
      },
      { new: true },
    );

    if (!updated) {
      return res.status(409).json({
        error: 'Investigation has already been submitted and scored',
        code: 'GAME_ALREADY_FINISHED',
      });
    }

    let scoreEntry;
    try {
      scoreEntry = await submitGameResult(req.team.teamId, 'investigation', points, updated);
    } catch (scoringError) {
      if (scoringError.code === 'RESULT_ALREADY_SUBMITTED') {
        scoreEntry = await ScoreEntry.findOne({
          teamId: req.team.teamId,
          round: 2,
          attemptNo: updated.attemptNo,
          game: 'investigation',
          kind: 'game_result',
        });
      } else {
        throw scoringError;
      }
    }

    await logEvent({
      type: 'investigation completed',
      actorType: 'team',
      actorId: req.team.teamId,
      teamId: req.team.teamId,
      details: {
        totalStages: TOTAL_STAGES,
        wrongAttempts: updated.progress?.wrongAttempts || 0,
        hintsUsed: updated.progress?.hintsUsed || 0,
        points,
        scoreEntryId: scoreEntry?._id,
      },
    });

    return res.json({
      ok: true,
      completed: true,
      points,
      message: 'Investigation completed! All leads solved and signal neutralized.',
      clues: getPublicInvestigationClues(TOTAL_STAGES, true),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/rounds/2/investigation/hint
 * Request a contextual hint for the active clue stage.
 * Enforces exactly one hint entitlement per team in Round 2 (-25 points penalty).
 */
router.post('/hint', requireTeam, validateBody(hintSchema), async (req, res, next) => {
  try {
    const roundState = getRound2State();
    if (!roundState || roundState.status !== 'running') {
      return res.status(409).json({
        ok: false,
        error: roundState?.status === 'paused'
          ? 'Cannot request hints while the round is paused'
          : 'Round 2 is not currently running',
        code: roundState?.status === 'paused' ? 'ROUND_PAUSED' : 'ROUND_NOT_RUNNING',
      });
    }

    const session = await GameSession.findOne({
      teamId: req.team.teamId,
      round: 2,
      attemptNo: roundState.attemptNo ?? 1,
      game: 'investigation',
      status: 'active',
    });

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: 'Active investigation session not found',
        code: 'GAME_SESSION_NOT_FOUND',
      });
    }

    const now = new Date();
    if (!isWithinDeadlines(session, roundState, now)) {
      session.status = 'expired';
      await session.save();
      return res.status(410).json({
        ok: false,
        error: 'Round or session deadline has expired',
        code: 'GAME_DEADLINE_PASSED',
      });
    }

    const { stage } = req.body;
    const currentStage = session.progress?.stage || 1;
    if (stage !== currentStage) {
      return res.status(400).json({
        ok: false,
        error: `Hint requested for stage ${stage}, but current active stage is ${currentStage}`,
        code: 'STAGE_MISMATCH',
      });
    }

    const hintText = STAGE_HINTS[stage];
    if (!hintText) {
      return res.status(400).json({ ok: false, error: 'Invalid hint stage', code: 'INVALID_STAGE' });
    }

    // 1. Check if either GameSession or HintEntitlement already consumed the single entitlement
    const existingEntitlement = await HintEntitlement.findOne({ teamId: req.team.teamId, round: 2 }).lean();
    if ((existingEntitlement && existingEntitlement.hintsUsed >= 1) || (session.progress?.hintsUsed >= 1)) {
      const existingRevealed = session.progress?.revealedHint
        || (existingEntitlement?.hintDetails ? {
          stage: existingEntitlement.hintDetails.stage,
          text: STAGE_HINTS[existingEntitlement.hintDetails.stage],
          unlockedAt: existingEntitlement.hintDetails.unlockedAt,
        } : null);
      return res.status(409).json({
        ok: false,
        error: 'Hint entitlement already consumed for Round 2. Only one hint is permitted per round.',
        code: 'HINT_ALREADY_USED',
        hintsUsed: 1,
        revealedHint: existingRevealed,
      });
    }

    // 2. Claim HintEntitlement atomically first
    let entitlementClaimed = false;
    let entitlementDoc;
    try {
      entitlementDoc = await HintEntitlement.findOneAndUpdate(
        {
          teamId: req.team.teamId,
          round: 2,
          $or: [
            { hintsUsed: { $exists: false } },
            { hintsUsed: 0 },
          ],
        },
        {
          $set: {
            hintsUsed: 1,
            hintDetails: {
              stage,
              penalty: 25,
              unlockedAt: new Date(),
            },
          },
        },
        { upsert: true, new: true },
      );
      entitlementClaimed = true;
    } catch (claimError) {
      if (claimError?.code === 11000) {
        return res.status(409).json({
          ok: false,
          error: 'Hint entitlement already consumed for Round 2. Only one hint is permitted per round.',
          code: 'HINT_ALREADY_USED',
          hintsUsed: 1,
        });
      }
      throw claimError;
    }

    if (!entitlementDoc || entitlementDoc.hintsUsed > 1) {
      return res.status(409).json({
        ok: false,
        error: 'Hint entitlement already consumed for Round 2. Only one hint is permitted per round.',
        code: 'HINT_ALREADY_USED',
        hintsUsed: 1,
      });
    }

    // 3. Atomically update GameSession with compensating rollback if it fails
    let updated;
    try {
      updated = await GameSession.findOneAndUpdate(
        {
          _id: session._id,
          status: 'active',
          $or: [
            { 'progress.hintsUsed': { $exists: false } },
            { 'progress.hintsUsed': 0 },
          ],
        },
        {
          $set: {
            'progress.hintsUsed': 1,
            'progress.revealedHint': {
              stage,
              text: hintText,
              unlockedAt: new Date(),
            },
          },
        },
        { new: true },
      );

      if (!updated) {
        // Compensating rollback: revert HintEntitlement
        await HintEntitlement.deleteOne({ teamId: req.team.teamId, round: 2 }).catch(() => {});
        return res.status(409).json({
          ok: false,
          error: 'Hint entitlement already consumed or session is no longer active.',
          code: 'HINT_ALREADY_USED',
          hintsUsed: 1,
        });
      }
    } catch (sessionError) {
      // Compensating rollback on database failure
      if (entitlementClaimed) {
        await HintEntitlement.deleteOne({ teamId: req.team.teamId, round: 2 }).catch(() => {});
      }
      throw sessionError;
    }

    await logEvent({
      type: 'investigation hint used',
      actorType: 'team',
      actorId: req.team.teamId,
      teamId: req.team.teamId,
      details: { stage, penalty: 25 },
    }).catch(() => {});

    return res.json({
      ok: true,
      stage,
      hint: hintText,
      hintsUsed: 1,
      penalty: 25,
      message: 'Tactical hint unlocked. A 25-point penalty has been applied to this round score.',
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
