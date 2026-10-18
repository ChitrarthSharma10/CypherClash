import express from 'express';
import { z } from 'zod';
import { Player } from '../models/Player.js';
import { requirePlayer } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';

const router = express.Router();
router.use(requirePlayer);
const emptyBodySchema = z.object({}).strict();

function isOnline(lastSeenAt) {
  return Boolean(lastSeenAt && Date.now() - lastSeenAt.getTime() <= 45_000);
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
    const players = await Player.find({ teamId: team.teamId }).select('slot lastSeenAt').lean();
    return res.json({
      teamId: team.teamId,
      name: team.name,
      biasPoints: team.biasPoints,
      players: ['P1', 'P2'].map((slot) => {
        const player = players.find((item) => item.slot === slot);
        return { slot, online: Boolean(player && isOnline(player.lastSeenAt)) };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/heartbeat', validateBody(emptyBodySchema), async (req, res, next) => {
  try {
    await Player.updateOne(
      { _id: req.session.playerId, teamId: req.session.teamId, slot: req.session.slot },
      { lastSeenAt: new Date() },
    );
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
