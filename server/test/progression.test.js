import './bootstrap.js';
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { sessionStore } from '../src/sessionStore.js';
import { GameSession } from '../src/models/GameSession.js';
import { Team } from '../src/models/Team.js';
import { Admin } from '../src/models/Admin.js';
import { ScoreEntry } from '../src/models/ScoreEntry.js';
import { RoundState } from '../src/models/RoundState.js';
import { EventLog } from '../src/models/EventLog.js';
import { TeamProgression } from '../src/models/TeamProgression.js';
import {
  endRound,
  initializeRoundStates,
  pauseRound,
  resumeRound,
  startRound,
} from '../src/services/roundState.js';
import { clearAllTotalsCache } from '../src/services/scoring.js';
import { getLeaderboard } from '../src/services/leaderboard.js';
import {
  advanceTeamProgression,
  getEffectiveProgression,
  isTeamEligibleForRound,
  revertProgressionOverride,
  setRoundStatus,
} from '../src/services/progression.js';
import { hashPassword } from '../src/utils/passwords.js';

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const team1Id = `CC-91${suffix}`;
const team2Id = `CC-92${suffix}`;
const password = 'ProgressionTestPassword123!';
const adminUsername = `progAdmin${suffix}`;
const adminPassword = 'ProgAdminPassword123!';
let server;
let baseUrl;

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

async function adminCookie() {
  const response = await request('/api/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

before(async () => {
  await connectDatabase();
  await GameSession.syncIndexes();
  await ScoreEntry.syncIndexes();
  await TeamProgression.syncIndexes();

  await Team.create({
    teamId: team1Id,
    name: `Team Alpha ${team1Id}`,
    passwordHash: await hashPassword(password),
  });
  await Team.create({
    teamId: team2Id,
    name: `Team Beta ${team2Id}`,
    passwordHash: await hashPassword(password),
  });
  await Admin.create({
    username: adminUsername,
    passwordHash: await hashPassword(adminPassword),
  });

  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await GameSession.deleteMany({ teamId: { $in: [team1Id, team2Id] } });
  await ScoreEntry.deleteMany({ teamId: { $in: [team1Id, team2Id] } });
  await TeamProgression.deleteMany({ teamId: { $in: [team1Id, team2Id] } });
  await RoundState.deleteMany({});
  await EventLog.deleteMany({ actorId: { $in: [team1Id, team2Id, 'system', adminUsername] } });
  clearAllTotalsCache();
  await initializeRoundStates();
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await GameSession.deleteMany({ teamId: { $in: [team1Id, team2Id] } });
  await ScoreEntry.deleteMany({ teamId: { $in: [team1Id, team2Id] } });
  await TeamProgression.deleteMany({ teamId: { $in: [team1Id, team2Id] } });
  await Team.deleteMany({ teamId: { $in: [team1Id, team2Id] } });
  await Admin.deleteMany({ username: adminUsername });
  await RoundState.deleteMany({});
  await EventLog.deleteMany({ actorId: { $in: [team1Id, team2Id, 'system', adminUsername] } });
  await sessionStore.close();
  await disconnectDatabase();
});

test('Default team creation initializes at Round 1 without waivers', async () => {
  const cookie = await adminCookie();
  const createRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: `New Team Default ${suffix}`,
    }),
  });
  assert.equal(createRes.status, 201);
  const data = await createRes.json();
  const createdTeamId = data.team.teamId;
  assert.ok(createdTeamId);

  const prog = await getEffectiveProgression(createdTeamId);
  assert.equal(prog.initialRound, 1);
  assert.equal(prog.maxEligibleRound, 1);
  assert.equal(prog.effectiveEligibleRound, 1);
  assert.deepEqual(prog.waivedRounds, []);
  assert.equal(prog.rounds[1].status, 'pending');
  assert.equal(prog.rounds[2].status, 'pending');

  await Team.deleteOne({ teamId: createdTeamId });
  await TeamProgression.deleteOne({ teamId: createdTeamId });
});

test('Team creation with initialProgression: 2 waives Round 1 without points', async () => {
  const cookie = await adminCookie();
  const createRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: `New Team R2 ${suffix}`,
      initialProgression: 2,
    }),
  });
  assert.equal(createRes.status, 201);
  const data = await createRes.json();
  const createdTeamId = data.team.teamId;

  const prog = await getEffectiveProgression(createdTeamId);
  assert.equal(prog.initialRound, 2);
  assert.equal(prog.maxEligibleRound, 2);
  assert.equal(prog.effectiveEligibleRound, 2);
  assert.deepEqual(prog.waivedRounds, [1]);
  assert.equal(prog.rounds[1].status, 'waived');
  assert.equal(prog.rounds[1].score, 0);

  // Score integrity: no artificial ScoreEntry exists
  const scores = await ScoreEntry.find({ teamId: createdTeamId });
  assert.equal(scores.length, 0);

  await Team.deleteOne({ teamId: createdTeamId });
  await TeamProgression.deleteOne({ teamId: createdTeamId });
});

test('Team creation with initialProgression: 3 waives Round 1 and Round 2', async () => {
  const cookie = await adminCookie();
  const createRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: `New Team R3 ${suffix}`,
      initialProgression: 3,
    }),
  });
  assert.equal(createRes.status, 201);
  const data = await createRes.json();
  const createdTeamId = data.team.teamId;

  const prog = await getEffectiveProgression(createdTeamId);
  assert.equal(prog.initialRound, 3);
  assert.equal(prog.maxEligibleRound, 3);
  assert.equal(prog.effectiveEligibleRound, 3);
  assert.deepEqual(prog.waivedRounds, [1, 2]);
  assert.equal(prog.rounds[1].status, 'waived');
  assert.equal(prog.rounds[2].status, 'waived');

  // Verify eligibility helper
  assert.equal(await isTeamEligibleForRound(createdTeamId, 1), true);
  assert.equal(await isTeamEligibleForRound(createdTeamId, 2), true);
  assert.equal(await isTeamEligibleForRound(createdTeamId, 3), true);
  assert.equal(await isTeamEligibleForRound(createdTeamId, 4), false);

  await Team.deleteOne({ teamId: createdTeamId });
  await TeamProgression.deleteOne({ teamId: createdTeamId });
});

test('Admin advances team to Round 2 with waived Round 1', async () => {
  const cookie = await adminCookie();
  const advanceRes = await request(`/api/admin/teams/${team1Id}/progression/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      targetRound: 2,
      waivePrior: true,
      reason: 'Technical glitch in Circuit Sync during live tournament',
    }),
  });
  assert.equal(advanceRes.status, 200);
  const data = await advanceRes.json();

  assert.equal(data.effectiveEligibleRound, 2);
  assert.deepEqual(data.waivedRounds, [1]);
  assert.equal(data.rounds[1].status, 'waived');

  // Audit log recorded
  const logs = await EventLog.find({ teamId: team1Id, type: 'progression advance' });
  assert.equal(logs.length, 1);
  assert.equal(logs[0].details.reason, 'Technical glitch in Circuit Sync during live tournament');
  assert.deepEqual(logs[0].details.newlyWaivedRounds, [1]);
});

test('Admin advances team to Round 3 waiving Round 1 and Round 2', async () => {
  const cookie = await adminCookie();
  const advanceRes = await request(`/api/admin/teams/${team1Id}/progression/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      targetRound: 3,
      waivePrior: true,
      reason: 'Administrative decision - late invited exhibition team',
    }),
  });
  assert.equal(advanceRes.status, 200);
  const data = await advanceRes.json();

  assert.equal(data.effectiveEligibleRound, 3);
  assert.deepEqual(data.waivedRounds, [1, 2]);
  assert.equal(data.rounds[1].status, 'waived');
  assert.equal(data.rounds[2].status, 'waived');

  // Waived rounds must contribute NO points to score or leaderboard
  const scores = await ScoreEntry.find({ teamId: team1Id });
  assert.equal(scores.length, 0);

  const leaderboard = await getLeaderboard();
  const entry = leaderboard.rows.find((item) => item.name.includes(team1Id));
  assert.ok(entry);
  assert.equal(entry.total, 0);
});

test('Admin waives and unwaives specific round requirement', async () => {
  const cookie = await adminCookie();

  // Waive Round 1
  const waiveRes = await request(`/api/admin/teams/${team1Id}/progression/waive`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      round: 1,
      status: 'waived',
      reason: 'Approved waiver exception',
    }),
  });
  assert.equal(waiveRes.status, 200);
  let prog = await waiveRes.json();
  assert.deepEqual(prog.waivedRounds, [1]);
  assert.equal(prog.rounds[1].status, 'waived');
  assert.equal(prog.effectiveEligibleRound, 2);

  // Set back to pending
  const pendingRes = await request(`/api/admin/teams/${team1Id}/progression/waive`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      round: 1,
      status: 'pending',
      reason: 'Exception revoked',
    }),
  });
  assert.equal(pendingRes.status, 200);
  prog = await pendingRes.json();
  assert.deepEqual(prog.waivedRounds, []);
  assert.equal(prog.rounds[1].status, 'pending');
  assert.equal(prog.effectiveEligibleRound, 1);
});

test('Admin cannot falsely claim completed_normally without completion evidence', async () => {
  const cookie = await adminCookie();

  // Attempt to mark Round 1 as completed_normally when no session or score entry exists
  const failRes = await request(`/api/admin/teams/${team1Id}/progression/waive`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      round: 1,
      status: 'completed_normally',
      reason: 'Falsely claiming gameplay completion',
    }),
  });
  assert.equal(failRes.status, 409);
  const data = await failRes.json();
  assert.equal(data.code, 'NO_COMPLETION_EVIDENCE');
});

test('Validation: Rejects invalid target round and missing reason', async () => {
  const cookie = await adminCookie();

  // Target round 0
  const invalidRoundRes = await request(`/api/admin/teams/${team1Id}/progression/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      targetRound: 0,
      reason: 'Test invalid round',
    }),
  });
  assert.equal(invalidRoundRes.status, 400);

  // Missing reason
  const missingReasonRes = await request(`/api/admin/teams/${team1Id}/progression/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      targetRound: 2,
      reason: '  ',
    }),
  });
  assert.equal(missingReasonRes.status, 400);
});

test('Progression checks gate Round 2 game access, respecting global round state', async () => {
  // Start Round 2 globally
  await startRound(2, 2700);

  const t1Cookie = await teamCookie(team1Id);

  // team1Id has NOT completed Round 1 and has no waiver -> direct game start must fail 403
  const directStartRes = await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: t1Cookie },
    body: JSON.stringify({}),
  });
  assert.equal(directStartRes.status, 403);
  const directData = await directStartRes.json();
  assert.equal(directData.code, 'PROGRESSION_PREREQUISITE_NOT_MET');

  // Direct resource navigation must also fail 403
  const directResAccess = await request('/api/rounds/2/investigation/resources/incident-log', {
    headers: { cookie: t1Cookie },
  });
  assert.equal(directResAccess.status, 403);

  // GET /state returns prerequisite_required
  const stateRes = await request('/api/rounds/2/investigation/state', {
    headers: { cookie: t1Cookie },
  });
  assert.equal(stateRes.status, 200);
  const stateData = await stateRes.json();
  assert.equal(stateData.status, 'prerequisite_required');

  // Now Admin waives Round 1 for team1Id
  const aCookie = await adminCookie();
  await request(`/api/admin/teams/${team1Id}/progression/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: aCookie },
    body: JSON.stringify({
      targetRound: 2,
      waivePrior: true,
      reason: 'Approved waiver for tournament',
    }),
  });

  // Now team1Id CAN start Round 2 investigation
  const startSuccessRes = await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: t1Cookie },
    body: JSON.stringify({}),
  });
  assert.equal(startSuccessRes.status, 200);

  // But team2Id is STILL un-waived and cannot access Round 2
  const t2Cookie = await teamCookie(team2Id);
  const t2StartRes = await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: t2Cookie },
    body: JSON.stringify({}),
  });
  assert.equal(t2StartRes.status, 403);

  // Global round restrictions still apply: pause Round 2
  await pauseRound(2);
  const pauseStartRes = await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: t1Cookie },
    body: JSON.stringify({}),
  });
  // Since session was already active, it returns 200 (existing session), but if round ended:
  await endRound(2);
  const endStateRes = await request('/api/rounds/2/investigation/state', {
    headers: { cookie: t1Cookie },
  });
  const endStateData = await endStateRes.json();
  assert.equal(endStateData.round.status, 'ended');
});

test('Reverting an override requires confirmation when gameplay records exist', async () => {
  const aCookie = await adminCookie();

  // Advance team1Id to Round 2
  await advanceTeamProgression(team1Id, {
    targetRound: 2,
    waivePriorRounds: true,
    reason: 'Advance for test',
    adminId: 'admin_test',
  });

  // Create an active game session in Round 2
  await GameSession.create({
    teamId: team1Id,
    round: 2,
    attemptNo: 1,
    game: 'investigation',
    status: 'active',
    seed: 'seed_for_revert_test',
    startedAt: new Date(),
    deadline: new Date(Date.now() + 100000),
  });

  // Revert without confirmDisruptive -> returns warning
  const revertWarnRes = await request(`/api/admin/teams/${team1Id}/progression/revert`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: aCookie },
    body: JSON.stringify({
      reason: 'Revoking early advance',
      confirmDisruptive: false,
    }),
  });
  assert.equal(revertWarnRes.status, 200);
  const warnData = await revertWarnRes.json();
  assert.equal(warnData.warning, true);
  assert.equal(warnData.requiresConfirmation, true);
  assert.equal(warnData.sessionsCount, 1);

  // Revert WITH confirmDisruptive: true
  const revertConfirmRes = await request(`/api/admin/teams/${team1Id}/progression/revert`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: aCookie },
    body: JSON.stringify({
      reason: 'Confirmed revocation of early advance',
      confirmDisruptive: true,
    }),
  });
  assert.equal(revertConfirmRes.status, 200);
  const revertData = await revertConfirmRes.json();
  assert.equal(revertData.maxEligibleRound, 1);
  assert.deepEqual(revertData.waivedRounds, []);

  // Historical game session must NOT be deleted
  const sessionAfter = await GameSession.findOne({ teamId: team1Id, round: 2 });
  assert.ok(sessionAfter);
  assert.equal(sessionAfter.status, 'active');
});

test('Security & Tenant Isolation: Normal team cannot access admin progression endpoints', async () => {
  const tCookie = await teamCookie(team1Id);

  // Attempt to call admin advance
  const advanceRes = await request(`/api/admin/teams/${team1Id}/progression/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: tCookie },
    body: JSON.stringify({
      targetRound: 3,
      waivePrior: true,
      reason: 'Team trying to advance self',
    }),
  });
  assert.equal([401, 403].includes(advanceRes.status), true);

  // Attempt to call admin progression detail
  const detailRes = await request(`/api/admin/teams/${team1Id}/progression`, {
    headers: { cookie: tCookie },
  });
  assert.equal([401, 403].includes(detailRes.status), true);

  // Team /me endpoint returns progression for the logged-in team only
  const meRes = await request('/api/team/me', {
    headers: { cookie: tCookie },
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.teamId, team1Id);
  assert.ok(meData.progression);
  assert.equal(meData.progression.teamId, team1Id);

  // Team /progression endpoint also returns progression
  const teamProgRes = await request('/api/team/progression', {
    headers: { cookie: tCookie },
  });
  assert.equal(teamProgRes.status, 200);
  const teamProgData = await teamProgRes.json();
  assert.equal(teamProgData.teamId, team1Id);
});

test('Persistence across refresh and re-login', async () => {
  const aCookie = await adminCookie();

  // Admin advances team1Id to Round 3
  await request(`/api/admin/teams/${team1Id}/progression/advance`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: aCookie },
    body: JSON.stringify({
      targetRound: 3,
      waivePrior: true,
      reason: 'Persistence test override',
    }),
  });

  // Team logs in anew and checks /me
  const tCookie = await teamCookie(team1Id);
  const meRes = await request('/api/team/me', {
    headers: { cookie: tCookie },
  });
  assert.equal(meRes.status, 200);
  const meData = await meRes.json();
  assert.equal(meData.progression.effectiveEligibleRound, 3);
  assert.deepEqual(meData.progression.waivedRounds, [1, 2]);

  // Read directly from DB to verify persistence
  const doc = await TeamProgression.findOne({ teamId: team1Id }).lean();
  assert.ok(doc);
  assert.equal(doc.maxEligibleRound, 3);
  assert.deepEqual(doc.waivedRounds, [1, 2]);
  assert.ok(doc.overrides.length > 0);
});
