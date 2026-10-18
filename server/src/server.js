import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase } from './db.js';
import { config } from './config.js';
import { initializeRoundStates, startRoundStateMonitor } from './services/roundState.js';
import { ScoreEntry } from './models/ScoreEntry.js';
import { attachSocketIo } from './realtime/socketHub.js';
import { rebuildLeaderboard } from './services/leaderboard.js';

await connectDatabase();
try {
  await ScoreEntry.syncIndexes();
  const indexes = await ScoreEntry.collection.indexes();
  const gameResultIndex = indexes.find((index) => index.name === 'teamId_1_round_1_game_1');
  if (
    !gameResultIndex
    || !gameResultIndex.unique
    || gameResultIndex.key.teamId !== 1
    || gameResultIndex.key.round !== 1
    || gameResultIndex.key.game !== 1
    || gameResultIndex.partialFilterExpression?.kind !== 'game_result'
  ) {
    console.warn('ScoreEntry game-result unique index is missing or misconfigured');
  }
} catch (error) {
  console.warn(
    'Unable to verify the ScoreEntry game-result unique index',
    error.name,
    error.code || 'unknown error',
  );
}
await initializeRoundStates();
await rebuildLeaderboard();
startRoundStateMonitor();
const httpServer = createServer(createApp());
attachSocketIo(httpServer);
httpServer.listen(config.port, () => {
  console.log(`CypherClash API listening on port ${config.port}`);
});
