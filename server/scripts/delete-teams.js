/**
 * delete-teams.js
 *
 * Permanently deletes tournament teams, scores, sessions, and optionally event logs and round states.
 * NEVER touches the admin collection.
 *
 * Usage:
 *   CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all
 *   CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all --everything
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

// ── 3. Check CLI flags & environment guards ──────────────────────────────────
const hasConfirmEnv = process.env.CONFIRM_DELETE_TEAMS === 'yes';
const hasAllFlag = process.argv.includes('--all');
const hasEverythingFlag = process.argv.includes('--everything');

if (!hasConfirmEnv) {
  console.error(
    'ERROR: Refusing to run.\n' +
    'Set the environment variable CONFIRM_DELETE_TEAMS=yes to allow this script to proceed.\n\n' +
    'Example:\n' +
    '  CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all\n' +
    '  CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all --everything',
  );
  process.exit(1);
}

if (!hasAllFlag) {
  console.log(
    'Usage:\n' +
    '  CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all\n' +
    '  CONFIRM_DELETE_TEAMS=yes npm --prefix server run teams:delete -- --all --everything\n\n' +
    'Flags:\n' +
    '  --all         Delete teams, scoreentries, gamesessions, and sessions.\n' +
    '  --everything  (Must be used with --all) Additionally delete all eventlogs\n' +
    '                and reset every RoundState to not_started.\n\n' +
    'Guards:\n' +
    '  • Never touches admins collection.\n' +
    '  • Requires typing the exact database name to confirm.\n',
  );
  process.exit(0);
}

// ── 4. Import models, DB, and existing sessionStore ──────────────────────────
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { Team } from '../src/models/Team.js';
import { ScoreEntry } from '../src/models/ScoreEntry.js';
import { GameSession } from '../src/models/GameSession.js';
import { EventLog } from '../src/models/EventLog.js';
import { RoundState } from '../src/models/RoundState.js';
import { sessionStore } from '../src/sessionStore.js';

async function cleanup() {
  try {
    await sessionStore.close();
  } catch {
    // Ignore cleanup error on store close
  }
  try {
    await disconnectDatabase();
  } catch {
    // Ignore cleanup error on db disconnect
  }
}

async function run() {
  try {
    await connectDatabase();
    console.log(`Connected. Database: ${databaseName}`);

    const sessionCollection = await sessionStore.collectionP;

    // ── 5. Dry-run counts ────────────────────────────────────────────────────
    const [teamCount, scoreCount, gameSessionCount, httpSessionCount] = await Promise.all([
      Team.countDocuments(),
      ScoreEntry.countDocuments(),
      GameSession.countDocuments(),
      sessionCollection.countDocuments(),
    ]);

    let eventLogCount = 0;
    let roundStateCount = 0;
    if (hasEverythingFlag) {
      [eventLogCount, roundStateCount] = await Promise.all([
        EventLog.countDocuments(),
        RoundState.countDocuments(),
      ]);
    }

    console.log('\n── Dry-run counts (collections to be modified) ────────────');
    console.log(`  teams          : ${teamCount}`);
    console.log(`  scoreentries   : ${scoreCount}`);
    console.log(`  gamesessions   : ${gameSessionCount}`);
    console.log(`  sessions       : ${httpSessionCount}`);
    if (hasEverythingFlag) {
      console.log(`  eventlogs      : ${eventLogCount}`);
      console.log(`  roundstates    : ${roundStateCount} (to reset to not_started)`);
    }
    console.log('────────────────────────────────────────────────────────────');

    console.log('\n── Untouched collections ───────────────────────────────────');
    console.log('  admins         : NEVER touched (preserved)');
    if (!hasEverythingFlag) {
      console.log('  roundstates    : NOT touched (use --everything to reset)');
      console.log('  eventlogs      : NOT touched (use --everything to delete)');
    }
    console.log('────────────────────────────────────────────────────────────\n');

    const totalToAffect = teamCount + scoreCount + gameSessionCount + httpSessionCount +
      (hasEverythingFlag ? eventLogCount + roundStateCount : 0);

    if (totalToAffect === 0) {
      console.log('All target collections are already empty. Nothing to delete.');
      await cleanup();
      process.exit(0);
    }

    // ── 6. Require operator to type the database name exactly ────────────────
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
      await cleanup();
      process.exit(0);
    }

    // ── 7. Execute wipe ──────────────────────────────────────────────────────
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

    let deletedEventLogs = 0;
    let resetRoundStates = 0;

    if (hasEverythingFlag) {
      const [eventsResult, roundStatesResult] = await Promise.all([
        EventLog.deleteMany({}),
        RoundState.updateMany({}, {
          $set: {
            status: 'not_started',
            attemptNo: 1,
            revision: 0,
            investigations: [],
          },
          $unset: {
            deadline: '',
            startedAt: '',
            pausedAt: '',
            endedAt: '',
          },
        }),
      ]);
      deletedEventLogs = eventsResult.deletedCount;
      resetRoundStates = roundStatesResult.modifiedCount;
    }

    // ── 8. Write audit EventLog (skip if eventlogs were wiped) ────────────────
    if (!hasEverythingFlag) {
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
        console.log('EventLog entry written (type: team_wipe).');
      } catch (logError) {
        console.warn('WARNING: EventLog write failed (wipe already completed):', logError.message);
      }
    } else {
      console.log('EventLog write skipped (--everything flag active: eventlogs were wiped).');
    }

    // ── 9. Report ────────────────────────────────────────────────────────────
    console.log('\n── Deleted / Reset ─────────────────────────────────────────');
    console.log(`  teams          : ${deletedTeams}`);
    console.log(`  scoreentries   : ${deletedScores}`);
    console.log(`  gamesessions   : ${deletedGameSessions}`);
    console.log(`  sessions       : ${deletedHttpSessions}`);
    if (hasEverythingFlag) {
      console.log(`  eventlogs      : ${deletedEventLogs}`);
      console.log(`  roundstates    : ${resetRoundStates} (reset to not_started)`);
    }
    console.log('────────────────────────────────────────────────────────────');
    console.log(
      '\nREMINDER: The running server process holds in-memory leaderboard and\n' +
      'totals caches. Restart the server so those caches reflect the empty\n' +
      'database (clearAllTotalsCache / invalidateLeaderboard will fire\n' +
      'automatically when the first request arrives after restart).',
    );

    await cleanup();
    process.exit(0);
  } catch (err) {
    console.error('\nERROR during deletion:', err);
    await cleanup();
    process.exit(1);
  }
}

await run();
