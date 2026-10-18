import MongoStore from 'connect-mongo';
import { config } from './config.js';

export const sessionStore = MongoStore.create({
  mongoUrl: config.mongoUri,
  ttl: 12 * 60 * 60,
  touchAfter: 10 * 60,
  stringify: false,
});

export async function destroyPlayerSessions(playerId) {
  const collection = await sessionStore.collectionP;
  await collection.deleteMany({ 'session.playerId': playerId });
}
