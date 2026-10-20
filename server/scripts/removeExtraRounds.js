import 'dotenv/config';
import mongoose from 'mongoose';
import { RoundState } from '../src/models/RoundState.js';
import { TOTAL_ROUNDS } from '../../shared/rounds.js';

function getDatabaseInfo(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGO_URI is invalid');
  }

  const hostname = parsed.hostname;
  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error('MONGO_URI database name is invalid');
  }
  return { hostname, databaseName: databaseName || 'test' };
}

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error('MONGO_URI must be configured');
}

const { hostname, databaseName } = getDatabaseInfo(uri);
console.log(`Target database: ${databaseName} on host ${hostname}`);

const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
const isTestDb = databaseName.endsWith('_test');

if (!isLocal && !isTestDb) {
  throw new Error(
    `SAFETY CHECK FAILED: Refusing to run cleanup against remote or non-test database "${databaseName}". ` +
    'This script may ONLY be executed against a local MongoDB instance (localhost/127.0.0.1) or a database ending in "_test".'
  );
}

if (process.env.CONFIRM_DELETE_EXTRA_ROUNDS !== 'yes') {
  throw new Error(
    'Refusing to delete extra round documents without explicit confirmation. ' +
    'Run with: CONFIRM_DELETE_EXTRA_ROUNDS=yes node server/scripts/removeExtraRounds.js'
  );
}

try {
  await mongoose.connect(uri);
  const result = await RoundState.deleteMany({ round: { $gt: TOTAL_ROUNDS } });
  console.log(`Successfully removed ${result.deletedCount} extra RoundState document(s) with round > ${TOTAL_ROUNDS}.`);
} catch (error) {
  const code = error.code ? ` (${error.code})` : '';
  console.error(`Failed to remove extra rounds: ${error.name || 'Error'}${code}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
