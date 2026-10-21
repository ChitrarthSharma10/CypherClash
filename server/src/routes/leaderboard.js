import express from 'express';
import { requireTeam } from '../middleware/auth.js';
import { getLeaderboard } from '../services/leaderboard.js';

const router = express.Router();

function requireLeaderboardReader(req, res, next) {
  if (req.session.role === 'admin') return next();
  if (req.session.role === 'team' && req.session.teamId) {
    return requireTeam(req, res, next);
  }
  // Public / guest view for main landing page scoreboard
  return next();
}

router.get('/', requireLeaderboardReader, async (req, res, next) => {
  try {
    return res.json(await getLeaderboard(req.team?.teamId || null));
  } catch (error) {
    return next(error);
  }
});

export default router;
