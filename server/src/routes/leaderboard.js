import express from 'express';
import { requirePlayer } from '../middleware/auth.js';
import { getLeaderboard } from '../services/leaderboard.js';

const router = express.Router();

function requireLeaderboardReader(req, res, next) {
  if (req.session.role === 'admin') return next();
  return requirePlayer(req, res, next);
}

router.get('/', requireLeaderboardReader, async (req, res, next) => {
  try {
    return res.json(await getLeaderboard(req.team?.teamId || null));
  } catch (error) {
    return next(error);
  }
});

export default router;
