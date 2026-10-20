/**
 * delete-teams.js
 *
 * Permanently deletes all Team, ScoreEntry, GameSession, and session documents.
 * Does NOT touch: admins, roundstates, eventlogs.
 * Writes one EventLog entry after the wipe (counts only, no team data).
 *
 * Usage:
 *   CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// ── 1. Load env + config (validates all required vars) ──────────────────────
import { config } from '../src/config.js';

// ── 2. Extract database NAME from URI (never print the URI itself) ───────────
function getDatabaseName(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGO_URI is not a valid URL');
  }
  let name;
  try {
    name = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error('MONGO_URI database name cannot be decoded');
  }
  return name || 'test';
}

const databaseName = getDatabaseName(config.mongoUri);

// ── 3. Refuse unless CONFIRM_DELETE_TEAMS=yes ────────────────────────────────
if (process.env.CONFIRM_DELETE_TEAMS !== 'yes') {
  console.error(
    'ERROR: Refusing to run.\n' +
    'Set the environment variable CONFIRM_DELETE_TEAMS=yes to allow this script to proceed.\n\n' +
    'Example:\n' +
    '  CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all',
  );
  process.exit(1);
}

// ── 4. Require --all flag ────────────────────────────────────────────────────
if (!process.argv.includes('--all')) {
  console.log(
    'Usage:\n' +
    '  CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all\n\n' +
    'This script deletes ALL documents from:\n' +
    '  • teams\n' +
    '  • scoreentries\n' +
    '  • gamesessions\n' +
    '  • sessions  (logs everyone out)\n\n' +
    'It does NOT touch: admins, roundstates, eventlogs.\n' +
    'It writes one EventLog record after the wipe.',
  );
  process.exit(0);
}

// ── 5. Connect ───────────────────────────────────────────────────────────────
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { Team } from '../src/models/Team.js';
import { ScoreEntry } from '../src/models/ScoreEntry.js';
import { GameSession } from '../src/models/GameSession.js';
import { EventLog } from '../src/models/EventLog.js';
import { sessionStore } from '../src/sessionStore.js';

await connectDatabase();
console.log(`Connected. Database: ${databaseName}`);

// ── 6. Dry-run counts ────────────────────────────────────────────────────────
const [teamCount, scoreCount, gameSessionCount] = await Promise.all([
  Team.countDocuments(),
  ScoreEntry.countDocuments(),
  GameSession.countDocuments(),
]);

// Use the existing shared sessionStore (same instance the app uses).
const sessionCollection = await sessionStore.collectionP;
const httpSessionCount = await sessionCollection.countDocuments();

console.log('\n── Dry-run counts ──────────────────────────────────────────');
console.log(`  teams          : ${teamCount}`);
console.log(`  scoreentries   : ${scoreCount}`);
console.log(`  gamesessions   : ${gameSessionCount}`);
console.log(`  sessions       : ${httpSessionCount}`);
console.log('────────────────────────────────────────────────────────────\n');

if (teamCount + scoreCount + gameSessionCount + httpSessionCount === 0) {
  console.log('All collections are already empty. Nothing to delete.');
  await sessionStore.close();
  await disconnectDatabase();
  process.exit(0);
}

// ── 7. Require operator to type the database name exactly ────────────────────
const rl = readline.createInterface({ input, output });
let answer;
try {
  answer = await rl.question(
    'Type the database name exactly to confirm deletion, or anything else to abort.\n' +
    'Database name: ',
  );
} finally {
  rl.close();
}

if (answer.trim() !== databaseName) {
  console.log('\nAborted — the name did not match. No data was deleted.');
  await sessionStore.close();
  await disconnectDatabase();
  process.exit(0);
}

// ── 8. Delete ────────────────────────────────────────────────────────────────
console.log('\nProceeding with deletion…');

const [teamsResult, scoresResult, gameSessionsResult] = await Promise.all([
  Team.deleteMany({}),
  ScoreEntry.deleteMany({}),
  GameSession.deleteMany({}),
]);

const sessionsResult = await sessionCollection.deleteMany({});

const deletedTeams = teamsResult.deletedCount;
const deletedScores = scoresResult.deletedCount;
const deletedGameSessions = gameSessionsResult.deletedCount;
const deletedHttpSessions = sessionsResult.deletedCount;

// ── 9. Write audit EventLog (counts only, no team data) ──────────────────────
// Wrapped in try/catch: the wipe is already done, a log failure must not mask that.
try {
  await EventLog.create({
    type: 'team_wipe',
    actorType: 'system',
    actorId: 'delete-teams',
    details: {
      deletedTeams,
      deletedScores,
      deletedGameSessions,
      deletedHttpSessions,
    },
  });
} catch (logError) {
  console.warn('WARNING: EventLog write failed (wipe already completed):', logError.message);
}

// ── 10. Report ───────────────────────────────────────────────────────────────
console.log('\n── Deleted ─────────────────────────────────────────────────');
console.log(`  teams          : ${deletedTeams}`);
console.log(`  scoreentries   : ${deletedScores}`);
console.log(`  gamesessions   : ${deletedGameSessions}`);
console.log(`  sessions       : ${deletedHttpSessions}`);
console.log('────────────────────────────────────────────────────────────');
console.log('EventLog entry written (type: team_wipe).');
console.log(
  '\nREMINDER: The running server process holds in-memory leaderboard and\n' +
  'totals caches. Restart the server so those caches reflect the empty\n' +
  'database (clearAllTotalsCache / invalidateLeaderboard will fire\n' +
  'automatically when the first request arrives after restart).',
);

await sessionStore.close();
await disconnectDatabase();
