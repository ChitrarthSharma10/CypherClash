import './bootstrap.js';
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { io as ClientIO } from 'socket.io-client';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { setupSocketIO } from '../src/socket.js';
import { sessionStore } from '../src/sessionStore.js';
import { Team } from '../src/models/Team.js';
import { Admin } from '../src/models/Admin.js';
import { RoundState } from '../src/models/RoundState.js';
import { GameSession } from '../src/models/GameSession.js';
import { ScoreEntry } from '../src/models/ScoreEntry.js';
import { hashPassword } from '../src/utils/passwords.js';
import { initializeRoundStates, endRound } from '../src/services/roundState.js';
import { clearAllTotalsCache } from '../src/services/scoring.js';
import { TOTAL_ROUNDS } from '../../shared/rounds.js';

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const teamId = `CC-88${suffix}`;
const password = 'TestTeamPassword123';
const adminUsername = `adm_rnd_${suffix}`;
const adminPassword = 'TestAdminPassword123';

let server;
let ioServer;
let baseUrl;

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function adminCookie() {
  const response = await request('/api/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

async function teamCookie() {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function connectSocketClient() {
  return ClientIO(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
}

before(async () => {
  await connectDatabase();
  await Team.create({
    teamId,
    name: 'Round Enforcement Team',
    passwordHash: await hashPassword(password),
  });
  await Admin.create({
    username: adminUsername,
    passwordHash: await hashPassword(adminPassword),
  });

  const app = createApp();
  server = http.createServer(app);
  ioServer = setupSocketIO(server);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await GameSession.deleteMany({ teamId });
  await ScoreEntry.deleteMany({ teamId });
  await RoundState.deleteMany({});
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    await RoundState.create({ round: r, status: 'not_started' });
  }
  clearAllTotalsCache();
  await initializeRoundStates();
});

after(async () => {
  if (ioServer) ioServer.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await Team.deleteMany({ teamId });
  await Admin.deleteMany({ username: adminUsername });
  await RoundState.deleteMany({});
  await GameSession.deleteMany({ teamId });
  await ScoreEntry.deleteMany({ teamId });
  await sessionStore.close();
  await disconnectDatabase();
});

test('rounds 4 and 5 are rejected with HTTP 400 on admin actions', async () => {
  const aCookie = await adminCookie();

  // Test round 4 actions
  const start4 = await request('/api/admin/rounds/4/start', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ durationSec: 1800 }),
  });
  assert.equal(start4.status, 400);

  const pause4 = await request('/api/admin/rounds/4/pause', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
  });
  assert.equal(pause4.status, 400);

  const resume4 = await request('/api/admin/rounds/4/resume', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
  });
  assert.equal(resume4.status, 400);

  const end4 = await request('/api/admin/rounds/4/end', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
  });
  assert.equal(end4.status, 400);

  // Test round 5 actions
  const start5 = await request('/api/admin/rounds/5/start', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ durationSec: 1800 }),
  });
  assert.equal(start5.status, 400);

  // Test round 0
  const start0 = await request('/api/admin/rounds/0/start', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
  });
  assert.equal(start0.status, 400);

  // Create legacy round 4 and 5 in database directly
  await RoundState.create({ round: 4, status: 'not_started' });
  await RoundState.create({ round: 5, status: 'not_started' });
  await initializeRoundStates();

  // Admin listing must ignore rounds 4 and 5 and list exactly 3 rounds
  const roundsListRes = await request('/api/admin/rounds', { headers: { cookie: aCookie } });
  assert.equal(roundsListRes.status, 200);
  const roundsList = await roundsListRes.json();
  assert.equal(roundsList.length, TOTAL_ROUNDS);
  assert.deepEqual(roundsList.map((r) => r.round), [1, 2, 3]);
});

test('starting round 1 unlocks all three Round 1 games, while rejecting others', async () => {
  const aCookie = await adminCookie();
  const tCookie = await teamCookie();

  // Admin starts Round 1
  const startRes = await request('/api/admin/rounds/1/start', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ durationSec: 1800 }),
  });
  assert.ok([200, 201].includes(startRes.status));

  // Circuit Sync is playable
  const circuitStart = await request('/api/games/circuit/start', {
    method: 'POST',
    headers: { cookie: tCookie, 'content-type': 'application/json' },
  });
  assert.equal(circuitStart.status, 200);

  // Maze socket join succeeds
  const mazeSocket = connectSocketClient();
  const mazeJoinOk = await new Promise((resolve) => {
    mazeSocket.on('maze:room_status', (data) => resolve(true));
    mazeSocket.on('maze:error_message', () => resolve(false));
    mazeSocket.emit('maze:join_room', {
      teamId,
      sessionId: `maze_${teamId}`,
      playerId: 'P1',
    });
  });
  mazeSocket.disconnect();
  assert.equal(mazeJoinOk, true);

  // Runner socket join succeeds
  const runnerSocket = connectSocketClient();
  const runnerJoinOk = await new Promise((resolve) => {
    runnerSocket.on('runner:room_status', (data) => resolve(true));
    runnerSocket.on('runner:error_message', () => resolve(false));
    runnerSocket.emit('runner:join_room', {
      teamId,
      sessionId: `runner_${teamId}`,
      playerId: 'P1',
    });
  });
  runnerSocket.disconnect();
  assert.equal(runnerJoinOk, true);

  // Round 2 investigation cannot be started during Round 1
  const r2GameStart = await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: tCookie, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(r2GameStart.status, 409);
});

test('round 2 and 3 start only their own games', async () => {
  const aCookie = await adminCookie();
  const tCookie = await teamCookie();

  // Waive Round 1 for team so they are eligible for Round 2
  await request(`/api/admin/teams/${teamId}/progression/waive`, {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ round: 1, status: 'waived', reason: 'Test progression' }),
  });

  // Admin starts Round 2
  const startR2 = await request('/api/admin/rounds/2/start', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ durationSec: 1800 }),
  });
  assert.ok([200, 201].includes(startR2.status));

  // Circuit Sync cannot start in Round 2
  const circuitInR2 = await request('/api/games/circuit/start', {
    method: 'POST',
    headers: { cookie: tCookie, 'content-type': 'application/json' },
  });
  assert.equal(circuitInR2.status, 409);
  assert.equal((await circuitInR2.json()).code, 'GAME_NOT_AVAILABLE_FOR_ROUND');

  // Maze socket join is refused in Round 2
  const mazeSocket = connectSocketClient();
  const mazeErrMsg = await new Promise((resolve) => {
    mazeSocket.on('maze:error_message', (msg) => resolve(msg?.message || msg));
    mazeSocket.on('maze:room_status', () => resolve(null));
    mazeSocket.emit('maze:join_room', {
      teamId,
      sessionId: `maze_${teamId}`,
      playerId: 'P1',
    });
  });
  mazeSocket.disconnect();
  assert.equal(mazeErrMsg, 'Round 1 is not running');

  // Runner socket join is refused in Round 2
  const runnerSocket = connectSocketClient();
  const runnerErrMsg = await new Promise((resolve) => {
    runnerSocket.on('runner:error_message', (msg) => resolve(msg?.message || msg));
    runnerSocket.on('runner:room_status', () => resolve(null));
    runnerSocket.emit('runner:join_room', {
      teamId,
      sessionId: `runner_${teamId}`,
      playerId: 'P1',
    });
  });
  runnerSocket.disconnect();
  assert.equal(runnerErrMsg, 'Round 1 is not running');

  // Round 2 Operation Shadow Beacon can be started
  const r2Start = await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: tCookie, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(r2Start.status, 200);

  // End Round 2 and start Round 3
  await request('/api/admin/rounds/2/end', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
  });

  const startR3 = await request('/api/admin/rounds/3/start', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ durationSec: 1800 }),
  });
  assert.ok([200, 201].includes(startR3.status));

  // Circuit Sync cannot start in Round 3
  const circuitInR3 = await request('/api/games/circuit/start', {
    method: 'POST',
    headers: { cookie: tCookie, 'content-type': 'application/json' },
  });
  assert.equal(circuitInR3.status, 409);
});

test('game join is refused when round is paused or ended', async () => {
  const aCookie = await adminCookie();
  const tCookie = await teamCookie();

  // Start Round 1
  await request('/api/admin/rounds/1/start', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ durationSec: 1800 }),
  });

  // Pause Round 1
  const pauseRes = await request('/api/admin/rounds/1/pause', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
  });
  assert.ok([200, 201].includes(pauseRes.status));

  // Circuit Sync refused while paused
  const circuitPaused = await request('/api/games/circuit/start', {
    method: 'POST',
    headers: { cookie: tCookie, 'content-type': 'application/json' },
  });
  assert.equal(circuitPaused.status, 409);

  // Maze join refused while paused
  const mazeSocket = connectSocketClient();
  const mazePauseErr = await new Promise((resolve) => {
    mazeSocket.on('maze:error_message', (msg) => resolve(msg?.message || msg));
    mazeSocket.on('maze:room_status', () => resolve(null));
    mazeSocket.emit('maze:join_room', {
      teamId,
      sessionId: `maze_${teamId}`,
      playerId: 'P1',
    });
  });
  mazeSocket.disconnect();
  assert.equal(mazePauseErr, 'Round 1 is not running');

  // Runner join refused while paused
  const runnerSocket = connectSocketClient();
  const runnerPauseErr = await new Promise((resolve) => {
    runnerSocket.on('runner:error_message', (msg) => resolve(msg?.message || msg));
    runnerSocket.on('runner:room_status', () => resolve(null));
    runnerSocket.emit('runner:join_room', {
      teamId,
      sessionId: `runner_${teamId}`,
      playerId: 'P1',
    });
  });
  runnerSocket.disconnect();
  assert.equal(runnerPauseErr, 'Round 1 is not running');

  // End Round 1
  await request('/api/admin/rounds/1/end', {
    method: 'POST',
    headers: { cookie: aCookie, 'content-type': 'application/json' },
  });

  // Circuit Sync refused while ended
  const circuitEnded = await request('/api/games/circuit/start', {
    method: 'POST',
    headers: { cookie: tCookie, 'content-type': 'application/json' },
  });
  assert.equal(circuitEnded.status, 409);
});
