import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';

export async function loadActivePlayer(req) {
  if (req.session.role !== 'player' || !req.session.playerId || !req.session.teamId || !req.session.slot) {
    return null;
  }

  const [player, team] = await Promise.all([
    Player.findOne({
      _id: req.session.playerId,
      teamId: req.session.teamId,
      slot: req.session.slot,
    }),
    Team.findOne({ teamId: req.session.teamId }),
  ]);

  if (!player || !team || !team.active) {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
    return null;
  }

  return { player, team };
}

export function requirePlayer(req, res, next) {
  loadActivePlayer(req)
    .then((result) => {
      if (!result) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.player = result.player;
      req.team = result.team;
      return next();
    })
    .catch(next);
}

export function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}
