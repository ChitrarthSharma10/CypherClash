import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import {
  adminSessionMiddleware,
  leaderboardSessionMiddleware,
  teamSessionMiddleware,
} from './sessionMiddleware.js';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/team.js';
import adminRoutes from './routes/admin.js';
import leaderboardRoutes from './routes/leaderboard.js';
import gameRoutes from './routes/games.js';
import investigationRoutes from './routes/investigation.js';
import round3Routes from './routes/round3.js';

const noStore = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: config.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: '20kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', noStore, authRoutes);
  app.use('/api/team', teamSessionMiddleware, teamRoutes);
  app.use('/api/admin', noStore, adminSessionMiddleware, adminRoutes);
  app.use('/api/leaderboard', noStore, leaderboardSessionMiddleware, leaderboardRoutes);
  app.use('/api/games', noStore, teamSessionMiddleware, gameRoutes);
  app.use('/api/rounds/2/investigation', noStore, teamSessionMiddleware, investigationRoutes);
  app.use('/api/rounds/3', noStore, teamSessionMiddleware, round3Routes);
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
