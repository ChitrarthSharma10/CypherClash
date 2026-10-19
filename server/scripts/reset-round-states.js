import 'dotenv/config';
import mongoose from 'mongoose';
import { RoundState } from '../src/models/RoundState.js';

function getDatabaseName(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGO_URI is invalid');
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error('MONGO_URI database name is invalid');
  }
  return databaseName || 'test';
}

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error('MONGO_URI must be configured');
}

const databaseName = getDatabaseName(uri);
console.log(`Database name: ${databaseName}`);

if (process.env.CONFIRM_ROUND_RESET !== 'yes') {
  throw new Error('Refusing to reset rounds: set CONFIRM_ROUND_RESET=yes to confirm');
}

try {
  await mongoose.connect(uri);
  const result = await RoundState.updateMany(
    {},
    {
      $set: { status: 'not_started' },
      $unset: { deadline: 1, startedAt: 1, pausedAt: 1 },
    },
  );
  console.log(`Changed documents: ${result.modifiedCount}`);
} catch (error) {
  const code = error.code ? ` (${error.code})` : '';
  console.error(`Round state reset failed: ${error.name || 'Error'}${code}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
