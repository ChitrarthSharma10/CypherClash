import './bootstrap.js';
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { sessionStore } from '../src/sessionStore.js';
import { Team } from '../src/models/Team.js';
import { ScoreEntry } from '../src/models/ScoreEntry.js';
import { RoundState } from '../src/models/RoundState.js';
import { EventLog } from '../src/models/EventLog.js';
import {
  endRound,
  getRoundState,
  initializeRoundStates,
  listRoundStates,
  pauseRound,
  resumeRound,
  startRound,
} from '../src/services/roundState.js';
import {
  addAdjustment,
  clearAllTotalsCache,
  getTotals,
  submitGameResult,
} from '../src/services/scoring.js';
import { hashPassword } from '../src/utils/passwords.js';

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const teamA = `CC-91${suffix}`;
const teamB = `CC-92${suffix}`;
const password = 'ScoringTestPassword123';
const firstTestRound = Date.now() * 10 + (process.pid % 10);
const testRounds = Array.from({ length: 10 }, (_, index) => firstTestRound + index);
let server;
let baseUrl;

async function createTeam(teamId) {
  return Team.create({
    teamId,
    name: `Test ${teamId}`,
    passwordHash: await hashPassword(password),
  });
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function teamCookie(teamId) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

before(async () => {
  await connectDatabase();
  await ScoreEntry.syncIndexes();
  await createTeam(teamA);
  await createTeam(teamB);
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await ScoreEntry.deleteMany({ teamId: { $in: [teamA, teamB] } });
  clearAllTotalsCache();
  await RoundState.deleteMany({ round: { $in: testRounds } });
  await EventLog.deleteMany({ actorId: /^scoring-test/ });
  await initializeRoundStates();
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await Team.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await ScoreEntry.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await RoundState.deleteMany({ round: { $in: testRounds } });
  await sessionStore.close();
  await disconnectDatabase();
});

test('rejects results while paused', async () => {
  const round = testRounds[0];
  await startRound(round, 60, 'scoring-test-admin');
  await pauseRound(round, 'scoring-test-admin');
  await assert.rejects(
    submitGameResult(teamA, 'maze', 10),
    { code: 'ROUND_NOT_RUNNING' },
  );
});

test('rejects starting another round while one is running', async () => {
  const runningRound = testRounds[0];
  await startRound(runningRound, 60, 'scoring-test-admin');

  await assert.rejects(
    startRound(testRounds[1], 60, 'scoring-test-admin'),
    { code: 'ROUND_ALREADY_STARTED' },
  );
});

test('rejects starting another round while one is paused', async () => {
  const pausedRound = testRounds[0];
  await startRound(pausedRound, 60, 'scoring-test-admin');
  await pauseRound(pausedRound, 'scoring-test-admin');

  await assert.rejects(
    startRound(testRounds[1], 60, 'scoring-test-admin'),
    { code: 'ROUND_ALREADY_STARTED' },
  );
});

test('concurrent starts leave at most one round active', async () => {
  const results = await Promise.allSettled([
    startRound(testRounds[0], 60, 'scoring-test-admin'),
    startRound(testRounds[1], 60, 'scoring-test-admin'),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    listRoundStates().filter((state) => state.status === 'running' || state.status === 'paused').length,
    1,
  );
});

test('records a game result against the one running round', async () => {
  const runningRound = testRounds[1];
  await startRound(runningRound, 60, 'scoring-test-admin');
  await assert.rejects(
    startRound(testRounds[2], 60, 'scoring-test-admin'),
    { code: 'ROUND_ALREADY_STARTED' },
  );

  const result = await submitGameResult(teamA, 'maze', 10);
  assert.equal(result.round, runningRound);
  assert.equal(await ScoreEntry.countDocuments({ teamId: teamA, round: runningRound }), 1);
  assert.equal(await ScoreEntry.countDocuments({ teamId: teamA, round: testRounds[2] }), 0);
});

test('allows exactly one simultaneous result for the same team and game', async () => {
  const round = testRounds[1];
  await startRound(round, 60, 'scoring-test-admin');
  const results = await Promise.allSettled([
    submitGameResult(teamA, 'maze', 10),
    submitGameResult(teamA, 'maze', 20),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
});

test('concurrent resume extends the deadline only once', async () => {
  const round = testRounds[2];
  const started = await startRound(round, 60, 'scoring-test-admin');
  await pauseRound(round, 'scoring-test-admin');
  await new Promise((resolve) => setTimeout(resolve, 25));
  const results = await Promise.allSettled([
    resumeRound(round, 'scoring-test-admin-1'),
    resumeRound(round, 'scoring-test-admin-2'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const resumed = getRoundState(round);
  assert.equal(resumed.status, 'running');
  assert.ok(resumed.deadline.getTime() > started.deadline.getTime());
  assert.ok(resumed.deadline.getTime() - started.deadline.getTime() >= 25);
  const persisted = await RoundState.findOne({ round }).lean();
  assert.equal(persisted.deadline.getTime(), resumed.deadline.getTime());
  assert.equal(persisted.pausedAt, undefined);
});

test('admin adjustment reason game_result does not occupy game-result slot', async () => {
  const round = testRounds[3];
  await startRound(round, 60, 'scoring-test-admin');
  await addAdjustment(teamA, round, 5, 'game_result', 'scoring-test-admin');
  await addAdjustment(teamA, round, 6, 'game_result', 'scoring-test-admin');
  await submitGameResult(teamA, 'maze', 10);
  assert.equal(await ScoreEntry.countDocuments({ teamId: teamA }), 3);
  assert.equal(
    await ScoreEntry.countDocuments({ teamId: teamA, kind: 'adjustment', reason: 'game_result' }),
    2,
  );
});

test('creates the unique game-result index with the requested key and filter', async () => {
  const indexes = await ScoreEntry.collection.indexes();
  const gameResultIndex = indexes.find(
    (index) => index.name === 'teamId_1_round_1_attemptNo_1_game_1',
  );
  assert.ok(gameResultIndex);
  assert.equal(gameResultIndex.unique, true);
  assert.deepEqual(gameResultIndex.key, { teamId: 1, round: 1, attemptNo: 1, game: 1 });
  assert.deepEqual(gameResultIndex.partialFilterExpression, { kind: 'game_result' });
});

test('restarting an ended round preserves old results and accepts one new attempt', async () => {
  const round = testRounds[0];
  const first = await startRound(round, 60, 'scoring-test-admin');
  const firstResult = await submitGameResult(teamA, 'maze', 10);
  await endRound(round, 'scoring-test-admin');
  const second = await startRound(round, 1800, 'scoring-test-admin');
  const secondResult = await submitGameResult(teamA, 'maze', 20);

  assert.equal(first.attemptNo, 1);
  assert.equal(firstResult.attemptNo, 1);
  assert.equal(second.attemptNo, 2);
  assert.equal(secondResult.attemptNo, 2);
  assert.equal(await ScoreEntry.countDocuments({ teamId: teamA, round, kind: 'game_result' }), 2);
  assert.equal((await getTotals(teamA)).rounds[round], 30);
});

test('reloads running and paused rounds from the database', async () => {
  const runningRound = testRounds[4];
  const pausedRound = testRounds[5];
  const running = await startRound(runningRound, 60, 'scoring-test-admin');
  await initializeRoundStates();
  const reloadedRunning = getRoundState(runningRound);
  assert.equal(reloadedRunning.status, 'running');
  assert.equal(reloadedRunning.deadline.getTime(), running.deadline.getTime());

  await endRound(runningRound, 'scoring-test-admin');
  await startRound(pausedRound, 60, 'scoring-test-admin');
  const paused = await pauseRound(pausedRound, 'scoring-test-admin');
  await initializeRoundStates();
  const reloadedPaused = getRoundState(pausedRound);
  assert.equal(reloadedPaused.status, 'paused');
  assert.equal(reloadedPaused.deadline.getTime(), paused.deadline.getTime());
  assert.equal(reloadedPaused.pausedAt.getTime(), paused.pausedAt.getTime());
});

test('team score endpoint only returns the logged-in team', async () => {
  const round = testRounds[6];
  await ScoreEntry.create({
    teamId: teamA,
    round,
    game: 'maze',
    kind: 'game_result',
    amount: 17,
    reason: 'game_result',
    actorType: 'system',
    actorId: 'system',
  });
  await ScoreEntry.create({
    teamId: teamB,
    round,
    game: 'maze',
    kind: 'game_result',
    amount: 93,
    reason: 'game_result',
    actorType: 'system',
    actorId: 'system',
  });
  clearAllTotalsCache();
  const cookie = await teamCookie(teamA);
  const response = await request('/api/team/score', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.teamId, teamA);
  assert.equal(body.total, 17);
  assert.equal(body.rounds[round], 17);
  assert.notEqual(body.teamId, teamB);
  assert.equal(JSON.stringify(body).includes(teamB), false);
});

test('team dashboard returns paused round timing from the server', async () => {
  const round = testRounds[8];
  await startRound(round, 60, 'scoring-test-admin');
  const paused = await pauseRound(round, 'scoring-test-admin');
  const cookie = await teamCookie(teamA);
  const response = await request('/api/team/me', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentRound.round, round);
  assert.equal(body.currentRound.status, 'paused');
  assert.equal(new Date(body.currentRound.pausedAt).getTime(), paused.pausedAt.getTime());
  assert.ok(body.lastSeenAt);
  assert.equal(
    body.currentRound.remainingMs,
    paused.deadline.getTime() - paused.pausedAt.getTime(),
  );
  assert.equal(body.online, true);
});

test('team dashboard reports 0 remainingMs when a round has ended', async () => {
  const round = testRounds[9];
  await startRound(round, 1800, 'scoring-test-admin');
  await endRound(round, 'scoring-test-admin');
  const cookie = await teamCookie(teamA);
  const response = await request('/api/team/me', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentRound.round, round);
  assert.equal(body.currentRound.status, 'ended');
  assert.equal(body.currentRound.remainingMs, 0);
});

test('team dashboard reports the active round instead of a later inactive round', async () => {
  const activeRound = testRounds[0];
  const laterRound = testRounds[1];
  await RoundState.create({ round: laterRound, status: 'not_started' });
  await initializeRoundStates();
  await startRound(activeRound, 60, 'scoring-test-admin');

  const cookie = await teamCookie(teamA);
  const response = await request('/api/team/me', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.currentRound.round, activeRound);
  assert.equal(body.currentRound.status, 'running');
});

test('team dashboard polling reuses score and presence memory without database writes', async () => {
  const cookie = await teamCookie(teamA);
  const firstScore = await request('/api/team/score', { headers: { cookie } });
  assert.equal(firstScore.status, 200);
  await firstScore.arrayBuffer();

  const aggregate = ScoreEntry.aggregate;
  const updateOne = Team.updateOne;
  let aggregateCalls = 0;
  let teamWrites = 0;
  ScoreEntry.aggregate = function (...args) {
    aggregateCalls += 1;
    return aggregate.apply(this, args);
  };
  Team.updateOne = function (...args) {
    teamWrites += 1;
    return updateOne.apply(this, args);
  };
  try {
    for (let index = 0; index < 5; index += 1) {
      const [dashboard, score] = await Promise.all([
        request('/api/team/me', { headers: { cookie } }),
        request('/api/team/score', { headers: { cookie } }),
      ]);
      assert.equal(dashboard.status, 200);
      assert.equal(score.status, 200);
      await Promise.all([dashboard.arrayBuffer(), score.arrayBuffer()]);
    }
  } finally {
    ScoreEntry.aggregate = aggregate;
    Team.updateOne = updateOne;
  }
  assert.equal(aggregateCalls, 0);
  assert.equal(teamWrites, 0);
});

test('rejects results after the round deadline', async () => {
  const round = testRounds[7];
  await startRound(round, 1, 'scoring-test-admin');
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await assert.rejects(
    submitGameResult(teamA, 'maze', 10),
    { code: 'ROUND_NOT_RUNNING' },
  );
});

test('only accepts whitelisted game names', async () => {
  const round = testRounds[0];
  await startRound(round, 60, 'scoring-test-admin');
  await assert.rejects(
    submitGameResult(teamA, 'unknown-game', 10),
    { code: 'INVALID_GAME' },
  );
});

test('investigation scoring formula: max(150, 500 - 15 * W) with floor 150', () => {
  const formula = (wrongCount) => Math.max(150, 500 - 15 * wrongCount);
  assert.equal(formula(0), 500);
  assert.equal(formula(2), 470);
  assert.equal(formula(4), 440);
  assert.equal(formula(10), 350);
  assert.equal(formula(28), 150);
  assert.equal(formula(29), 150);
  assert.equal(formula(100), 150);
});

test('double scoring prevention: team cannot be scored twice for the same game attempt', async () => {
  const round = testRounds[8];
  await startRound(round, 60, 'scoring-test-admin');
  const first = await submitGameResult(teamA, 'investigation', 470);
  assert.ok(first._id);

  await assert.rejects(
    submitGameResult(teamA, 'investigation', 500),
    { code: 'RESULT_ALREADY_SUBMITTED' },
  );

  const count = await ScoreEntry.countDocuments({ teamId: teamA, round, game: 'investigation' });
  assert.equal(count, 1);
});

