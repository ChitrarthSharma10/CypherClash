import dns from 'node:dns';
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch {}
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase } from './db.js';
import { config } from './config.js';
import { initializeRoundStates, startRoundStateMonitor } from './services/roundState.js';
import { ScoreEntry } from './models/ScoreEntry.js';
import { GameSession } from './models/GameSession.js';
import { rebuildLeaderboard } from './services/leaderboard.js';
import { setupSocketIO } from './socket.js';

await connectDatabase();
await GameSession.createIndexes();
try {
  await ScoreEntry.syncIndexes();
  const indexes = await ScoreEntry.collection.indexes();
  console.info(`ScoreEntry indexes: ${indexes.map(({ name }) => name).join(', ')}`);
  const gameResultIndex = indexes.find(
    (index) => index.name === 'teamId_1_round_1_attemptNo_1_game_1',
  );
  const gameResultIndexes = indexes.filter(
    (index) => index.unique && index.partialFilterExpression?.kind === 'game_result',
  );
  if (
    !gameResultIndex
    || gameResultIndexes.length !== 1
    || !gameResultIndex.unique
    || gameResultIndex.key.teamId !== 1
    || gameResultIndex.key.round !== 1
    || gameResultIndex.key.attemptNo !== 1
    || gameResultIndex.key.game !== 1
    || gameResultIndex.partialFilterExpression?.kind !== 'game_result'
    || indexes.some((index) => index.name === 'teamId_1_round_1_game_1')
  ) {
    throw new Error('ScoreEntry game-result unique index is missing or misconfigured');
  }
} catch (error) {
  console.error('Unable to sync or verify ScoreEntry indexes', error.name, error.code || 'unknown error');
  throw error;
}
await initializeRoundStates();
await rebuildLeaderboard();
startRoundStateMonitor();
const httpServer = createServer(createApp());
setupSocketIO(httpServer);
httpServer.listen(config.port, () => {
  console.log(`Cyber Clash API listening on port ${config.port}`);
});
