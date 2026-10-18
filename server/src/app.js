import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { sessionMiddleware } from './sessionMiddleware.js';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/team.js';
import adminRoutes from './routes/admin.js';
import leaderboardRoutes from './routes/leaderboard.js';

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
  app.use(sessionMiddleware);

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', noStore, authRoutes);
  app.use('/api/team', teamRoutes);
  app.use('/api/admin', noStore, adminRoutes);
  app.use('/api/leaderboard', noStore, leaderboardRoutes);
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
