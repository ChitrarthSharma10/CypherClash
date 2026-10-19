import { Team } from '../models/Team.js';

export async function loadActiveTeam(req) {
  if (req.session?.role !== 'team' || !req.session?.teamId) {
    return null;
  }

  const team = await Team.findOne({ teamId: req.session.teamId });
  if (!team || !team.active) {
    if (req.session) {
      await new Promise((resolve, reject) => {
        req.session.destroy((error) => (error ? reject(error) : resolve()));
      });
    }
    return null;
  }
  return team;
}

export function requireTeam(req, res, next) {
  loadActiveTeam(req)
    .then((team) => {
      if (!team) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      req.team = team;
      return next();
    })
    .catch(next);
}

export function requireAdmin(req, res, next) {
  if (req.session?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}
