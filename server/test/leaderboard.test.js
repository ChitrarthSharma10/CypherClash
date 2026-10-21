import './bootstrap.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { Admin } from '../src/models/Admin.js';
import { EventLog } from '../src/models/EventLog.js';
import { RoundState } from '../src/models/RoundState.js';
import { ScoreEntry } from '../src/models/ScoreEntry.js';
import { Team } from '../src/models/Team.js';
import { sessionStore } from '../src/sessionStore.js';
import { computeTotal, rebuildLeaderboard } from '../src/services/leaderboard.js';
import { initializeRoundStates } from '../src/services/roundState.js';
import { hashPassword } from '../src/utils/passwords.js';

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const adminUsername = `lbadmin${process.pid}`;
const adminPassword = 'LeaderboardAdminPassword123';
const teamPassword = 'LeaderboardTeamPassword123';
const teamIds = Array.from({ length: 65 }, (_, index) => `CC-${suffix}${index}`);
const teamNames = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((name) => `LB ${suffix} ${name}`);
const roundNumbers = [1, 2, 3];
const allowedRowKeys = ['name', 'r1', 'r2', 'r3', 'rank', 'total'];
const originalRounds = new Map();
let httpServer;
let baseUrl;

async function login(path, credentials) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

async function waitForBoard(predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/leaderboard`, {
      headers: { cookie: teamCookie },
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    if (predicate(payload)) return payload;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for leaderboard REST update');
}

let teamCookie;

before(async () => {
  await connectDatabase();
  const savedRoundStates = await RoundState.find({ round: { $in: roundNumbers } }).lean();
  for (const [index, round] of roundNumbers.entries()) {
    originalRounds.set(round, savedRoundStates.find((state) => state.round === round) || null);
    await RoundState.findOneAndUpdate(
      { round },
      {
        $set: {
          status: index === 0 ? 'running' : 'ended',
          startedAt: new Date(),
          deadline: new Date(Date.now() + 60 * 60_000),
          durationSec: 3600,
        },
        $unset: { pausedAt: 1 },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  await initializeRoundStates();

  const passwordHash = await hashPassword(teamPassword);
  const teams = await Team.create(teamIds.slice(0, 4).map((teamId, index) => ({
    teamId,
    name: teamNames[index],
    passwordHash,
  })));
  await Team.create(teamIds.slice(4).map((teamId, index) => ({
    teamId,
    name: `Load Team ${String(index).padStart(2, '0')}`,
    passwordHash,
  })));
  await Admin.create({
    username: adminUsername,
    passwordHash: await hashPassword(adminPassword),
  });
  for (const [index, amount] of [1000, 999, 999, 998].entries()) {
    await ScoreEntry.create({
      teamId: teamIds[index],
      round: 1,
      game: 'leaderboard_test',
      kind: 'adjustment',
      amount,
      reason: 'leaderboard test score',
      actorType: 'admin',
      actorId: adminUsername,
    });
  }

  httpServer = createServer(createApp());
  await new Promise((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  teamCookie = await login('/api/auth/login', {
    teamId: teamIds[0],
    password: teamPassword,
  });
  await login('/api/auth/admin/login', { username: adminUsername, password: adminPassword });
  await rebuildLeaderboard();
});

after(async () => {
  await new Promise((resolve) => setTimeout(resolve, 2200));
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await Team.deleteMany({ teamId: { $in: teamIds } });
  await ScoreEntry.deleteMany({ teamId: { $in: teamIds } });
  await Admin.deleteOne({ username: adminUsername });
  await EventLog.deleteMany({ actorId: adminUsername });
  await RoundState.deleteMany({ round: { $in: roundNumbers } });
  for (const [round, savedState] of originalRounds) {
    if (savedState) await RoundState.collection.insertOne(savedState);
  }
  await initializeRoundStates();
  await sessionStore.close();
  await disconnectDatabase();
});

test('leaderboard helpers compute totals correctly', () => {
  assert.equal(computeTotal(100, null, 25), 125);
  assert.equal(computeTotal(null, null, null), 0);
});

test('REST leaderboard has an allowlisted public shape and tied round-only ranks', async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/leaderboard`);
  assert.equal(unauthenticated.status, 200);
  const unauthPayload = await unauthenticated.json();
  assert.equal(unauthPayload.youIndex, null);
  assert.ok(Array.isArray(unauthPayload.rows));

  const adminCookie = await login('/api/auth/admin/login', {
    username: adminUsername,
    password: adminPassword,
  });
  const adminResponse = await fetch(`${baseUrl}/api/leaderboard`, {
    headers: { cookie: adminCookie },
  });
  assert.equal(adminResponse.status, 200);

  const response = await fetch(`${baseUrl}/api/leaderboard`, {
    headers: { cookie: teamCookie },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const restPayload = await response.json();
  const { rows, updatedAt, youIndex } = restPayload;
  assert.ok(updatedAt);
  assert.deepEqual(Object.keys(restPayload).sort(), ['rows', 'updatedAt', 'youIndex']);
  assert.equal(youIndex, rows.findIndex((row) => row.name === teamNames[0]));
  assert.ok(rows.every((row) => {
    const keys = Object.keys(row).sort();
    return JSON.stringify(keys) === JSON.stringify([...allowedRowKeys].sort());
  }));
  assert.ok(rows.every((row) => !('teamId' in row) && !('players' in row) && !('username' in row) && !('bias' in row)));
  assert.deepEqual(Object.keys(rows[0]).sort(), ['name', 'r1', 'r2', 'r3', 'rank', 'total']);

  const byName = new Map(rows.map((row) => [row.name, row]));
  assert.equal(byName.get(teamNames[0]).rank, 1);
  assert.equal(byName.get(teamNames[1]).rank, 2);
  assert.equal(byName.get(teamNames[2]).rank, 2);
  assert.equal(byName.get(teamNames[3]).rank, 4);
  assert.ok(byName.get(teamNames[3]).total < byName.get(teamNames[0]).total);
  assert.equal(byName.get(teamNames[0]).r1, 1000);
  assert.equal(byName.get(teamNames[0]).r2, 0);
});

test('disabled teams leave the board and re-enabled teams return', async () => {
  const adminCookie = await login('/api/auth/admin/login', {
    username: adminUsername,
    password: adminPassword,
  });
  const patch = async (active) => fetch(`${baseUrl}/api/admin/teams/${teamIds[3]}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ active }),
  });
  try {
    assert.equal((await patch(false)).status, 200);
    const removed = await waitForBoard((board) => !board.rows.some((row) => row.name === teamNames[3]));
    assert.equal(removed.rows.some((row) => row.name === teamNames[3]), false);
  } finally {
    await patch(true);
  }
  const restored = await waitForBoard((board) => board.rows.some((row) => row.name === teamNames[3]));
  assert.equal(restored.rows.some((row) => row.name === teamNames[3]), true);
});

test('rounds not started are null rather than zero', async () => {
  await RoundState.updateOne({ round: 3 }, { $set: { status: 'not_started' } });
  await initializeRoundStates();
  await rebuildLeaderboard();
  const board = await fetch(`${baseUrl}/api/leaderboard`, {
    headers: { cookie: teamCookie },
  }).then((response) => response.json());
  assert.equal(board.rows.find((row) => row.name === teamNames[0]).r3, null);
  await RoundState.updateOne({ round: 1 }, { $set: { status: 'ended' } });
  await RoundState.updateOne({ round: 3 }, { $set: { status: 'running' } });
  await initializeRoundStates();
  await rebuildLeaderboard();
});

test('REST leaderboard polls reuse the in-memory snapshot', async () => {
  const adminCookie = await login('/api/auth/admin/login', {
    username: adminUsername,
    password: adminPassword,
  });
  await fetch(`${baseUrl}/api/leaderboard`, { headers: { cookie: adminCookie } });
  const teamFind = Team.find;
  const scoreAggregate = ScoreEntry.aggregate;
  let leaderboardTeamReads = 0;
  let ledgerAggregates = 0;
  Team.find = function (...args) {
    leaderboardTeamReads += 1;
    return teamFind.apply(this, args);
  };
  ScoreEntry.aggregate = function (...args) {
    ledgerAggregates += 1;
    return scoreAggregate.apply(this, args);
  };
  try {
    for (let index = 0; index < 65; index += 1) {
      const response = await fetch(`${baseUrl}/api/leaderboard`, {
        headers: { cookie: adminCookie },
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(Object.keys(payload).sort(), ['rows', 'updatedAt', 'youIndex']);
      assert.ok(payload.rows.every((row) => (
        JSON.stringify(Object.keys(row).sort()) === JSON.stringify([...allowedRowKeys].sort())
      )));
    }
  } finally {
    Team.find = teamFind;
    ScoreEntry.aggregate = scoreAggregate;
  }
  assert.equal(leaderboardTeamReads, 0);
  assert.equal(ledgerAggregates, 0);
});
