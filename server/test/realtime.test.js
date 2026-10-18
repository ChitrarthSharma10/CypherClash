import './bootstrap.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { io as createClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { EventLog } from '../src/models/EventLog.js';
import { Admin } from '../src/models/Admin.js';
import { Player } from '../src/models/Player.js';
import { RoundState } from '../src/models/RoundState.js';
import { ScoreEntry } from '../src/models/ScoreEntry.js';
import { Team } from '../src/models/Team.js';
import { sessionStore } from '../src/sessionStore.js';
import { attachSocketIo } from '../src/realtime/socketHub.js';
import { startRound } from '../src/services/roundState.js';
import { hashPassword } from '../src/utils/passwords.js';

const suffix = `${Date.now()}${process.pid}`;
const teamId = `CC-${suffix}`;
const adminUsername = `rtadmin${process.pid}`;
const adminPassword = 'RealtimeAdminPassword123';
const round = Number(`${Date.now()}${process.pid}`) + 100;
const password = 'RealtimeTestPassword123';
const received = { P1: [], P2: [] };
const receivedPresence = { P1: [], P2: [] };
const receivedRound = { P1: [], P2: [] };
let httpServer;
let baseUrl;
let clients = [];

function waitForState(socket, history, predicate, fromIndex = 0, timeoutMs = 5000) {
  const existing = history.slice(fromIndex).find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('cs:state', listener);
      reject(new Error('Timed out waiting for Circuit Sync state'));
    }, timeoutMs);
    function listener(state) {
      if (!predicate(state)) return;
      clearTimeout(timeout);
      socket.off('cs:state', listener);
      resolve(state);
    }
    socket.on('cs:state', listener);
  });
}

function waitForMessage(socket, eventName, history, predicate, fromIndex = 0, timeoutMs = 5000) {
  const existing = history.slice(fromIndex).find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, listener);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);
    function listener(message) {
      if (!predicate(message)) return;
      clearTimeout(timeout);
      socket.off(eventName, listener);
      resolve(message);
    }
    socket.on(eventName, listener);
  });
}

async function login(slot) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, slot, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

function createSocket({ cookie, origin = config.frontendOrigin, transport = 'websocket' } = {}) {
  const socket = createClient(baseUrl, {
    transports: [transport],
    reconnection: false,
    extraHeaders: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: origin,
    },
  });
  clients.push(socket);
  return socket;
}

function connectPlayer(cookie, slot) {
  const socket = createSocket({ cookie });
  socket.on('cs:state', (state) => received[slot].push(state));
  socket.on('cs:presence', (presence) => receivedPresence[slot].push(presence));
  socket.on('cs:round', (roundState) => receivedRound[slot].push(roundState));
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function expectConnectionRejected(options) {
  const socket = createSocket(options);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => reject(new Error('Socket unexpectedly connected')));
    socket.once('connect_error', (error) => {
      socket.disconnect();
      resolve(error);
    });
    setTimeout(() => {
      socket.disconnect();
      reject(new Error('Timed out waiting for connection rejection'));
    }, 5000).unref();
  });
}

async function adminCookie() {
  const response = await fetch(`${baseUrl}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

async function changeRound(roundNumber, action, cookie) {
  const response = await fetch(`${baseUrl}/api/admin/rounds/${roundNumber}/${action}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
    },
    body: JSON.stringify({}),
  });
  assert.ok(response.ok, `Admin ${action} failed with ${response.status}`);
  return response.json();
}

function waitForDisconnect(socket) {
  if (!socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket did not disconnect')), 5000);
    socket.once('disconnect', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function findSolution(state) {
  const { switchCount, gates, target, lampCount } = state;
  for (let mask = 0; mask < 2 ** switchCount; mask += 1) {
    const switches = Array.from({ length: switchCount }, (_, index) => Boolean(mask & (1 << index)));
    const nodes = [...switches];
    for (const gate of gates) {
      const first = nodes[gate.a];
      const second = nodes[gate.b];
      const output = {
        AND: first && second,
        OR: first || second,
        XOR: first !== second,
        NAND: !(first && second),
        NOR: !(first || second),
      }[gate.op];
      nodes.push(output);
    }
    const lamps = nodes.slice(-lampCount);
    if (lamps.every((value, index) => value === target[index])) return switches;
  }
  throw new Error('No solution found for generated Circuit Sync stage');
}

before(async () => {
  await connectDatabase();
  const team = await Team.create({ teamId, name: 'Realtime Test Team' });
  for (const slot of ['P1', 'P2']) {
    await Player.create({
      team: team._id,
      teamId,
      slot,
      passwordHash: await hashPassword(password),
    });
  }
  await Admin.create({
    username: adminUsername,
    passwordHash: await hashPassword(adminPassword),
  });
  await startRound(round, 120, 'realtime-test-admin');
  httpServer = createServer(createApp());
  attachSocketIo(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  for (const client of clients) client.disconnect();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await Player.deleteMany({ teamId });
  await Admin.deleteOne({ username: adminUsername });
  await Team.deleteOne({ teamId });
  await ScoreEntry.deleteMany({ teamId });
  await RoundState.deleteOne({ round });
  await EventLog.deleteMany({ actorId: 'realtime-test-admin' });
  await sessionStore.close();
  await disconnectDatabase();
});

test('Circuit Sync preserves private views, pause, refresh, full completion, and score totals', async () => {
  const [cookieP1, cookieP2] = await Promise.all([login('P1'), login('P2')]);
  let socketP1;
  let socketP2;
  [socketP1, socketP2] = await Promise.all([
    connectPlayer(cookieP1, 'P1'),
    connectPlayer(cookieP2, 'P2'),
  ]);
  const [p1Presence, p1Round] = await Promise.all([
    waitForMessage(socketP1, 'cs:presence', receivedPresence.P1, (presence) => presence.teammateConnected),
    waitForMessage(socketP1, 'cs:round', receivedRound.P1, (state) => state.status === 'running' && state.round === round),
  ]);
  assert.equal(p1Presence.teammateConnected, true);
  assert.ok(p1Round.remainingMs > 0);
  const adminTeamsResponse = await fetch(`${baseUrl}/api/admin/teams`, {
    headers: { cookie: await adminCookie() },
  });
  assert.equal(adminTeamsResponse.status, 200);
  const adminTeams = await adminTeamsResponse.json();
  const connectedTeam = adminTeams.find((team) => team.teamId === teamId);
  assert.equal(connectedTeam.players.find((player) => player.slot === 'P1').online, true);
  assert.equal(connectedTeam.players.find((player) => player.slot === 'P2').online, true);

  const [stateP1, stateP2] = await Promise.all([
    waitForState(socketP1, received.P1, (state) => state.stage === 1),
    waitForState(socketP2, received.P2, (state) => state.stage === 1),
  ]);
  assert.equal(Object.hasOwn(stateP1, 'switches'), false);
  assert.equal(Object.hasOwn(stateP2, 'gates'), false);
  assert.equal(Object.hasOwn(stateP2, 'target'), false);

  const adminSession = await adminCookie();
  await changeRound(round, 'pause', adminSession);
  const pausedRound = await waitForMessage(
    socketP1,
    'cs:round',
    receivedRound.P1,
    (state) => state.status === 'paused' && state.round === round,
  );
  const pausedP2State = received.P2.at(-1);
  const statesBeforePausedInput = received.P2.length;
  socketP2.emit('cs:toggle', { idx: 0 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(received.P2.length, statesBeforePausedInput);
  assert.deepEqual(received.P2.at(-1).switches, pausedP2State.switches);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const laterPausedRound = receivedRound.P1.filter((state) => state.status === 'paused').at(-1);
  assert.equal(laterPausedRound.remainingMs, pausedRound.remainingMs);
  await changeRound(round, 'resume', adminSession);
  await waitForMessage(
    socketP1,
    'cs:round',
    receivedRound.P1,
    (state) => state.status === 'running' && state.round === round,
  );

  async function solveStage(stageNumber) {
    const [analyst, operator] = await Promise.all([
      waitForState(socketP1, received.P1, (state) => state.stage === stageNumber && state.role === 'analyst'),
      waitForState(socketP2, received.P2, (state) => state.stage === stageNumber && state.role === 'operator'),
    ]);
    const solution = findSolution(analyst);
    for (const [idx, value] of solution.entries()) {
      if (value !== operator.switches[idx]) {
        socketP2.emit('cs:toggle', { idx });
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
    await waitForState(
      socketP2,
      received.P2,
      (state) => state.stage === stageNumber
        && state.switches?.every((value, idx) => value === solution[idx]),
    );
    const nextState = waitForState(
      socketP1,
      received.P1,
      (state) => state.done || state.stage === stageNumber + 1,
    );
    socketP2.emit('cs:submit', {});
    return nextState;
  }

  const nextStageTwo = await solveStage(1);
  assert.equal(nextStageTwo.stage, 2);

  const p2RefreshStart = received.P2.length;
  const oldP2Disconnect = waitForDisconnect(socketP2);
  socketP2 = await connectPlayer(cookieP2, 'P2');
  await oldP2Disconnect;
  const restoredP2 = await waitForState(
    socketP2,
    received.P2,
    (state) => state.stage === 2,
    p2RefreshStart,
  );
  assert.ok(restoredP2.switches.every((value) => !value));

  const previousStateCount = received.P1.length;
  const reconnectedP1 = await connectPlayer(cookieP1, 'P1');
  const recoveredView = await waitForState(
    reconnectedP1,
    received.P1,
    (state) => state.stage === 2,
    previousStateCount,
  );
  assert.equal(Object.hasOwn(recoveredView, 'switches'), false);
  assert.equal(reconnectedP1.connected, true);

  const replacedP1Disconnect = waitForDisconnect(reconnectedP1);
  const replacementP1 = await connectPlayer(cookieP1, 'P1');
  socketP1 = replacementP1;
  await replacedP1Disconnect;
  assert.equal(reconnectedP1.connected, false);
  assert.equal(replacementP1.connected, true);
  const replacementPresence = await waitForMessage(
    replacementP1,
    'cs:presence',
    receivedPresence.P1,
    (presence) => presence.teammateConnected,
  );
  assert.equal(replacementPresence.teammateConnected, true);

  const nextStageThree = await solveStage(2);
  assert.equal(nextStageThree.stage, 3);
  const completion = await solveStage(3);
  assert.equal(completion.done, true);
  assert.ok(completion.points > 0);
  assert.ok(received.P1.every((state) => !Object.hasOwn(state, 'switches')));
  assert.ok(received.P2.every((state) => !Object.hasOwn(state, 'gates') && !Object.hasOwn(state, 'target')));
  const scoreResponse = await fetch(`${baseUrl}/api/team/score`, {
    headers: { cookie: cookieP1 },
  });
  assert.equal(scoreResponse.status, 200);
  const score = await scoreResponse.json();
  assert.equal(score.teamId, teamId);
  assert.equal(score.total, completion.points);
  assert.equal(score.rounds[round], completion.points);

  const p2PresenceStart = receivedPresence.P2.length;
  replacementP1.disconnect();
  const teammateLeft = await waitForMessage(
    socketP2,
    'cs:presence',
    receivedPresence.P2,
    (presence) => !presence.teammateConnected,
    p2PresenceStart,
  );
  assert.equal(teammateLeft.teammateConnected, false);
});

test('rejects sockets without player authentication and with the wrong Origin', async () => {
  const unauthenticatedError = await expectConnectionRejected({});
  assert.match(unauthenticatedError.message, /Authentication required/);

  const cookie = await login('P1');
  const wrongOriginError = await expectConnectionRejected({
    cookie,
    origin: 'https://invalid.example',
    transport: 'polling',
  });
  assert.ok(wrongOriginError);
  const originResponse = await fetch(
    `${baseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`,
    { headers: { Origin: 'https://invalid.example' } },
  );
  assert.equal(originResponse.status, 400);
  const allowedOriginResponse = await fetch(
    `${baseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`,
    { headers: { Origin: config.frontendOrigin } },
  );
  assert.equal(allowedOriginResponse.status, 200);
  await allowedOriginResponse.body?.cancel();
});

test('admin team disable immediately disconnects that team sockets', async () => {
  const cookieP1 = await login('P1');
  const cookieP2 = await login('P2');
  const [socketP1, socketP2] = await Promise.all([
    connectPlayer(cookieP1, 'P1'),
    connectPlayer(cookieP2, 'P2'),
  ]);
  await waitForState(socketP1, received.P1, (state) => state.stage === 1);
  const disconnectP1 = waitForDisconnect(socketP1);
  const disconnectP2 = waitForDisconnect(socketP2);
  const response = await fetch(`${baseUrl}/api/admin/teams/${teamId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      cookie: await adminCookie(),
    },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(response.status, 200);
  await Promise.all([disconnectP1, disconnectP2]);
  assert.equal(socketP1.connected, false);
  assert.equal(socketP2.connected, false);
});
