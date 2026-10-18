import session from 'express-session';
import { config } from './config.js';
import { sessionStore } from './sessionStore.js';

export const sessionMiddleware = session({
  name: 'connect.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    maxAge: 12 * 60 * 60 * 1000,
  },
});
