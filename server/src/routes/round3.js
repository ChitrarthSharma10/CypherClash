import express from 'express';
import { requireTeam } from '../middleware/auth.js';
import { HintEntitlement } from '../models/HintEntitlement.js';
import { getRoundState, listRoundStates } from '../services/roundState.js';
import { isTeamEligibleForRound } from '../services/progression.js';
import { logEvent } from '../utils/logging.js';

const router = express.Router();

function getRound3State() {
  const round = getRoundState(3);
  if (round) return round;
  const fromList = listRoundStates().find((item) => item.round === 3);
  return fromList || null;
}

/**
 * GET /api/rounds/3/hint/status
 * Returns the current team's Round 3 hint entitlement status.
 */
router.get('/hint/status', requireTeam, async (req, res, next) => {
  try {
    const entitlement = await HintEntitlement.findOne({
      teamId: req.team.teamId,
      round: 3,
    }).lean();

    const eligible = await isTeamEligibleForRound(req.team.teamId, 3);

    return res.json({
      ok: true,
      round: 3,
      hintsUsed: entitlement?.hintsUsed || 0,
      maxHints: 1,
      available: (entitlement?.hintsUsed || 0) === 0,
      eligible,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/rounds/3/hint
 * Consumes the single Round 3 hint entitlement atomically.
 * Independent of Round 2 entitlements.
 */
router.post('/hint', requireTeam, async (req, res, next) => {
  try {
    const roundState = getRound3State();
    if (!roundState || roundState.status !== 'running') {
      return res.status(409).json({
        ok: false,
        error: roundState?.status === 'paused'
          ? 'Cannot request hints while Round 3 is paused'
          : 'Round 3 is not currently running',
        code: roundState?.status === 'paused' ? 'ROUND_PAUSED' : 'ROUND_NOT_RUNNING',
      });
    }

    if (roundState.deadline && roundState.deadline.getTime() <= Date.now()) {
      return res.status(410).json({
        ok: false,
        error: 'Round 3 deadline has passed',
        code: 'ROUND_DEADLINE_PASSED',
      });
    }

    if (!(await isTeamEligibleForRound(req.team.teamId, 3))) {
      return res.status(403).json({
        ok: false,
        error: 'Team does not meet the progression prerequisites for Round 3',
        code: 'PROGRESSION_PREREQUISITE_NOT_MET',
      });
    }

    // Atomic update to consume Round 3 entitlement
    const updated = await HintEntitlement.findOneAndUpdate(
      {
        teamId: req.team.teamId,
        round: 3,
        $or: [
          { hintsUsed: { $exists: false } },
          { hintsUsed: 0 },
        ],
      },
      {
        $set: {
          hintsUsed: 1,
          hintDetails: {
            unlockedAt: new Date(),
          },
        },
      },
      { upsert: true, new: true },
    );

    if (!updated || updated.hintsUsed > 1) {
      return res.status(409).json({
        ok: false,
        error: 'Hint entitlement already consumed for Round 3. Only one hint is permitted per round.',
        code: 'HINT_ALREADY_USED',
        hintsUsed: 1,
      });
    }

    await logEvent({
      type: 'round 3 hint used',
      actorType: 'team',
      actorId: req.team.teamId,
      teamId: req.team.teamId,
      details: { round: 3 },
    });

    return res.json({
      ok: true,
      round: 3,
      hintsUsed: 1,
      message: 'Round 3 hint entitlement consumed. Contextual clue available upon Round 3 game release.',
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        ok: false,
        error: 'Hint entitlement already consumed for Round 3. Only one hint is permitted per round.',
        code: 'HINT_ALREADY_USED',
        hintsUsed: 1,
      });
    }
    return next(error);
  }
});

export default router;
