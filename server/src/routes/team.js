import express from 'express';
import { z } from 'zod';
import { requirePlayer } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { getTotals } from '../services/scoring.js';
import { listRoundStates } from '../services/roundState.js';
import { isPlayerOnline, recordPlayerPresence } from '../services/presence.js';

const router = express.Router();
router.use(requirePlayer);
const emptyBodySchema = z.object({}).strict();

function currentRound() {
  const rounds = listRoundStates();
  const now = Date.now();
  const round = rounds.at(-1);
  if (!round) {
    return { round: null, status: 'not_started', deadline: null, pausedAt: null, remainingMs: null };
  }
  const status = round.status === 'running' && round.deadline?.getTime() <= now
    ? 'ended'
    : round.status;
  const referenceTime = round.status === 'paused' && round.pausedAt
    ? round.pausedAt.getTime()
    : now;
  return {
    round: round.round,
    status,
    deadline: round.deadline || null,
    pausedAt: round.pausedAt || null,
    remainingMs: round.deadline
      ? Math.max(0, round.deadline.getTime() - referenceTime)
      : null,
  };
}

router.get('/me', async (req, res, next) => {
  try {
    const team = req.team;
    if (!team || !team.active) {
      await new Promise((resolve, reject) => {
        req.session.destroy((error) => (error ? reject(error) : resolve()));
      });
      return res.status(401).json({ error: 'Authentication required' });
    }
    recordPlayerPresence(team.teamId, req.player.slot);
    return res.json({
      teamId: team.teamId,
      name: team.name,
      biasPoints: team.biasPoints,
      players: ['P1', 'P2'].map((slot) => ({
        slot,
        online: isPlayerOnline(team.teamId, slot),
      })),
      currentRound: currentRound(),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/score', async (req, res, next) => {
  try {
    return res.json(await getTotals(req.team.teamId));
  } catch (error) {
    return next(error);
  }
});

router.post('/heartbeat', validateBody(emptyBodySchema), async (req, res, next) => {
  try {
    recordPlayerPresence(req.team.teamId, req.player.slot);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
