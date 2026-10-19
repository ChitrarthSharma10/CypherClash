import dns from 'node:dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch {}
import MongoStore from 'connect-mongo';
import { config } from './config.js';

export const sessionStore = MongoStore.create({
  mongoUrl: config.mongoUri,
  ttl: 12 * 60 * 60,
  touchAfter: 10 * 60,
  stringify: false,
});

export async function destroyTeamSessions(teamId) {
  const collection = await sessionStore.collectionP;
  const query = { 'session.role': 'team', 'session.teamId': teamId };
  await collection.deleteMany(query);
}
