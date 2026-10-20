import './bootstrap.js';
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { sessionStore } from '../src/sessionStore.js';
import { GameSession } from '../src/models/GameSession.js';
import { Team } from '../src/models/Team.js';
import { Admin } from '../src/models/Admin.js';
import { ScoreEntry } from '../src/models/ScoreEntry.js';
import { RoundState } from '../src/models/RoundState.js';
import { EventLog } from '../src/models/EventLog.js';
import { HintEntitlement } from '../src/models/HintEntitlement.js';
import { TeamProgression } from '../src/models/TeamProgression.js';
import {
  endRound,
  initializeRoundStates,
  pauseRound,
  resumeRound,
  startRound,
} from '../src/services/roundState.js';
import { clearAllTotalsCache } from '../src/services/scoring.js';
import { getLeaderboard, rebuildLeaderboard } from '../src/services/leaderboard.js';
import { calculateInvestigationPoints, INVESTIGATION_CLUES, STAGE_HINTS } from '../src/games/investigation.js';
import { hashPassword } from '../src/utils/passwords.js';

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const teamA = `CC-81${suffix}`;
const teamB = `CC-82${suffix}`;
const password = 'InvestigationTestPassword123';
const adminUsername = `invAdmin${suffix}`;
const adminPassword = 'InvAdminPassword123!';
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
  await HintEntitlement.syncIndexes();
  await Team.create({
    teamId: teamA,
    name: `Test Alpha ${teamA}`,
    passwordHash: await hashPassword(password),
  });
  await Team.create({
    teamId: teamB,
    name: `Test Beta ${teamB}`,
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
  await GameSession.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await ScoreEntry.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await HintEntitlement.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await TeamProgression.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await TeamProgression.create([
    { teamId: teamA, initialRound: 3, maxEligibleRound: 3, waivedRounds: [1, 2] },
    { teamId: teamB, initialRound: 3, maxEligibleRound: 3, waivedRounds: [1, 2] },
  ]);
  await RoundState.deleteMany({});
  await EventLog.deleteMany({ actorId: { $in: [teamA, teamB, 'system'] } });
  clearAllTotalsCache();
  await initializeRoundStates();
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await GameSession.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await ScoreEntry.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await HintEntitlement.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await TeamProgression.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await Team.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await Admin.deleteMany({ username: adminUsername });
  await RoundState.deleteMany({});
  await EventLog.deleteMany({ actorId: { $in: [teamA, teamB, 'system'] } });
  await sessionStore.close();
  await disconnectDatabase();
});

test('calculateInvestigationPoints respects base 500, -15 penalty, -25 hint, and floor 150', () => {
  assert.equal(calculateInvestigationPoints({ wrongAttempts: 0, hintsUsed: 0 }), 500);
  assert.equal(calculateInvestigationPoints({ wrongAttempts: 1, hintsUsed: 0 }), 485);
  assert.equal(calculateInvestigationPoints({ wrongAttempts: 2, hintsUsed: 1 }), 445);
  assert.equal(calculateInvestigationPoints({ wrongAttempts: 20, hintsUsed: 1 }), 175);
  // Floor at 150 points
  assert.equal(calculateInvestigationPoints({ wrongAttempts: 30, hintsUsed: 1 }), 150);
  assert.equal(calculateInvestigationPoints({ wrongAttempts: 100, hintsUsed: 1 }), 150);
});

test('Hints do not expose canonical answers or final flags', () => {
  for (const clue of INVESTIGATION_CLUES) {
    const hint = STAGE_HINTS[clue.stage];
    assert.ok(hint, `Stage ${clue.stage} must have a contextual hint`);
    assert.equal(hint.includes(clue.expectedAnswer), false, `Hint for stage ${clue.stage} must not reveal the exact answer`);
    assert.equal(hint.includes('CC{DOM_SLEUTH_N3TW0RK_941}'), false, 'Hints must not reveal the final flag');
  }
});

test('unauthenticated requests cannot access investigation state, resources, hints, or start game', async () => {
  const endpoints = [
    { method: 'GET', path: '/api/rounds/2/investigation/state' },
    { method: 'POST', path: '/api/rounds/2/investigation/start' },
    { method: 'POST', path: '/api/rounds/2/investigation/submit' },
    { method: 'POST', path: '/api/rounds/2/investigation/hint' },
    { method: 'GET', path: '/api/rounds/2/investigation/resources/incident-log' },
    { method: 'GET', path: '/api/rounds/3/hint/status' },
    { method: 'POST', path: '/api/rounds/3/hint' },
  ];
  for (const ep of endpoints) {
    const res = await request(ep.path, {
      method: ep.method,
      headers: { 'content-type': 'application/json' },
      body: ep.method === 'POST' ? '{}' : undefined,
    });
    assert.equal(res.status, 401, `Expected 401 for ${ep.method} ${ep.path}`);
  }
});

test('Round 2 cannot start while it has not been started by admin', async () => {
  const cookie = await teamCookie(teamA);
  const res = await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.code, 'ROUND_NOT_RUNNING');
});

test('Resource route access control prevents skipping stages or accessing locked resources', async () => {
  await startRound(2, 2700, 'admin');
  const cookie = await teamCookie(teamA);

  // Before starting session: access to resources is blocked
  const earlyRes = await request('/api/rounds/2/investigation/resources/incident-log', {
    headers: { cookie },
  });
  assert.equal(earlyRes.status, 403);

  // Start session
  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: '{}',
  });

  // Stage 1 resource is accessible
  const logRes = await request('/api/rounds/2/investigation/resources/incident-log', {
    headers: { cookie },
  });
  assert.equal(logRes.status, 200);
  const logData = await logRes.json();
  assert.ok(logData.html.includes('X-Origin-Node: ALPHA-RELAY-77'));

  // Stage 2, 3, 4 resources are locked and reject with 403 RESOURCE_LOCKED
  for (const slug of ['advisory', 'terminal', 'vault']) {
    const lockedRes = await request(`/api/rounds/2/investigation/resources/${slug}`, {
      headers: { cookie },
    });
    assert.equal(lockedRes.status, 403);
    const lockedData = await lockedRes.json();
    assert.equal(lockedData.code, 'RESOURCE_LOCKED');
  }

  // Unknown resource returns 404
  const notFoundRes = await request('/api/rounds/2/investigation/resources/non-existent-asset', {
    headers: { cookie },
  });
  assert.equal(notFoundRes.status, 404);
});

test('Investigation lifecycle, hints, scoring formula, ledger integration, and repeat protection', async () => {
  await startRound(2, 2700, 'admin');
  const cookieA = await teamCookie(teamA);

  // 1. Initial state
  let stateRes = await request('/api/rounds/2/investigation/state', { headers: { cookie: cookieA } });
  let stateData = await stateRes.json();
  assert.equal(stateData.status, 'not_started');

  // 2. Start game
  const startRes = await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(startRes.status, 200);

  // 3. Stage 1 hint request
  const hintRes = await request('/api/rounds/2/investigation/hint', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1 }),
  });
  assert.equal(hintRes.status, 200);
  const hintData = await hintRes.json();
  assert.equal(hintData.hintsUsed, 1);
  assert.equal(hintData.penalty, 25);
  assert.ok(hintData.hint.length > 0);

  // 4. Second hint request in Round 2 must be rejected with 409 HINT_ALREADY_USED
  const secondHintRes = await request('/api/rounds/2/investigation/hint', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1 }),
  });
  assert.equal(secondHintRes.status, 409);
  const secondHintData = await secondHintRes.json();
  assert.equal(secondHintData.code, 'HINT_ALREADY_USED');

  // 5. Wrong answer penalty check (2 wrong attempts)
  const wrong1 = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'WRONG-1' }),
  });
  assert.equal(wrong1.status, 422);
  const wrong2 = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'WRONG-2' }),
  });
  assert.equal(wrong2.status, 422);

  // Check state reflects 2 wrong attempts and revealed hint
  stateRes = await request('/api/rounds/2/investigation/state', { headers: { cookie: cookieA } });
  stateData = await stateRes.json();
  assert.equal(stateData.session.wrongAttempts, 2);
  assert.equal(stateData.session.hintsUsed, 1);
  assert.equal(stateData.session.revealedHint?.stage, 1);

  // Verify no score is awarded yet for incomplete investigation
  const midEntries = await ScoreEntry.find({ teamId: teamA, round: 2 });
  assert.equal(midEntries.length, 0);

  // 6. Complete stage 1
  const stage1Res = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'ALPHA-RELAY-77' }),
  });
  assert.equal(stage1Res.status, 200);

  // Stage 2 resource is now unlocked
  const advisoryRes = await request('/api/rounds/2/investigation/resources/advisory', { headers: { cookie: cookieA } });
  assert.equal(advisoryRes.status, 200);
  const advisoryData = await advisoryRes.json();
  assert.ok(advisoryData.html.includes('FRAME-SHIFT-246'));
  assert.ok(advisoryData.html.includes('Three records describe the same moment, yet their stories refuse to agree'));

  // 7. Verify old Lead 2 answer is rejected
  const oldStage2Res = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 2, answer: 'SEC-VAULT-909' }),
  });
  assert.equal(oldStage2Res.status, 422);

  // Complete stage 2 with new answer
  const stage2Res = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 2, answer: 'FRAME-SHIFT-246' }),
  });
  assert.equal(stage2Res.status, 200);

  // Stage 3 resource is now unlocked
  const terminalRes = await request('/api/rounds/2/investigation/resources/terminal', { headers: { cookie: cookieA } });
  assert.equal(terminalRes.status, 200);
  const terminalData = await terminalRes.json();
  assert.ok(terminalData.html.includes('The latest record appears innocent'));
  assert.ok(terminalData.html.includes('campus-relay-telemetry'));

  // 8. Verify old Lead 3 answers are rejected
  const oldStage3Res = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 3, answer: 'REWIND-KEY-731' }),
  });
  assert.equal(oldStage3Res.status, 422);

  // Complete stage 3 with new challenge token
  const stage3Res = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 3, answer: 'hellowor!d' }),
  });
  assert.equal(stage3Res.status, 200);

  // Stage 4 resource (vault) is now unlocked
  const vaultRes = await request('/api/rounds/2/investigation/resources/vault', { headers: { cookie: cookieA } });
  assert.equal(vaultRes.status, 200);
  const vaultData = await vaultRes.json();
  assert.ok(vaultData.html.includes('The vault has kept the truth in fragments'));
  assert.ok(vaultData.html.includes('Signal Reconstruction'));

  // Verify old Lead 4 answer is rejected
  const oldStage4Res = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 4, answer: 'CC{DOM_SLEUTH_N3TW0RK_941}' }),
  });
  assert.equal(oldStage4Res.status, 422);

  // 9. Complete stage 4 (final keyword)
  // Formula: max(150, 500 - (15 * 5) - (25 * 1))
  // wrongAttempts: 2 initial + 1 (old stage 2) + 1 (old stage 3) + 1 (old stage 4) = 5 wrong attempts
  // Penalty = 5 * 15 + 25 = 75 + 25 = 100 -> Score = 400 points
  const finalRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 4, answer: 'UNMASKED' }),
  });
  assert.equal(finalRes.status, 200);
  const finalData = await finalRes.json();
  assert.equal(finalData.completed, true);
  assert.equal(finalData.points, 400);

  // 10. Ledger verification: exactly ONE ScoreEntry must exist
  const scoreEntries = await ScoreEntry.find({ teamId: teamA, round: 2, kind: 'game_result' });
  assert.equal(scoreEntries.length, 1);
  assert.equal(scoreEntries[0].amount, 400);
  assert.equal(scoreEntries[0].game, 'investigation');

  // 11. Replay and duplicate submission protection: repeated final submit returns 409
  const repeatRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 4, answer: 'UNMASKED' }),
  });
  assert.equal(repeatRes.status, 409);
  const repeatEntries = await ScoreEntry.find({ teamId: teamA, round: 2, kind: 'game_result' });
  assert.equal(repeatEntries.length, 1);

  // 12. Leaderboard integration
  await rebuildLeaderboard();
  const board = await getLeaderboard(teamA);
  const row = board.rows.find((r) => r.name === `Test Alpha ${teamA}`);
  assert.ok(row);
  assert.equal(row.r2, 400);
  assert.equal(row.total, 400);
});

test('Concurrent final submissions cannot create duplicate ScoreEntry records', async () => {
  await startRound(2, 2700, 'admin');
  const cookieA = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: '{}',
  });

  // Solve stages 1-3
  for (const [stage, answer] of [[1, 'ALPHA-RELAY-77'], [2, 'FRAME-SHIFT-246'], [3, 'hellowor!d']]) {
    await request('/api/rounds/2/investigation/submit', {
      method: 'POST',
      headers: { cookie: cookieA, 'content-type': 'application/json' },
      body: JSON.stringify({ stage, answer }),
    });
  }

  // Fire 5 concurrent final submissions for stage 4
  const promises = Array.from({ length: 5 }, () =>
    request('/api/rounds/2/investigation/submit', {
      method: 'POST',
      headers: { cookie: cookieA, 'content-type': 'application/json' },
      body: JSON.stringify({ stage: 4, answer: 'UNMASKED' }),
    })
  );

  const responses = await Promise.all(promises);
  const statuses = responses.map((r) => r.status);
  // Exactly one request must succeed with 200, others receive 409
  assert.equal(statuses.filter((s) => s === 200).length, 1);
  assert.equal(statuses.filter((s) => s === 409).length, 4);

  // Verify only 1 ScoreEntry exists
  const entries = await ScoreEntry.find({ teamId: teamA, round: 2, kind: 'game_result' });
  assert.equal(entries.length, 1);
});

test('Concurrent hint requests in Round 2 cannot consume multiple hints', async () => {
  await startRound(2, 2700, 'admin');
  const cookieA = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: '{}',
  });

  // Send 5 concurrent hint requests for stage 1
  const promises = Array.from({ length: 5 }, () =>
    request('/api/rounds/2/investigation/hint', {
      method: 'POST',
      headers: { cookie: cookieA, 'content-type': 'application/json' },
      body: JSON.stringify({ stage: 1 }),
    })
  );

  const responses = await Promise.all(promises);
  const statuses = responses.map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 200).length, 1);
  assert.equal(statuses.filter((s) => s === 409).length, 4);

  const session = await GameSession.findOne({ teamId: teamA, round: 2 });
  assert.equal(session.progress.hintsUsed, 1);
});

test('Round 2 and Round 3 hint entitlements are independent and isolated', async () => {
  // Start Round 2 and use hint
  await startRound(2, 2700, 'admin');
  const cookieA = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: '{}',
  });

  await request('/api/rounds/2/investigation/hint', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1 }),
  });

  // End Round 2 and start Round 3
  await endRound(2, 'admin');
  await startRound(3, 1800, 'admin');

  // Round 3 status shows hint is available (0 hints used)
  const statusRes = await request('/api/rounds/3/hint/status', { headers: { cookie: cookieA } });
  assert.equal(statusRes.status, 200);
  const statusData = await statusRes.json();
  assert.equal(statusData.hintsUsed, 0);
  assert.equal(statusData.available, true);

  // Consume Round 3 hint
  const r3HintRes = await request('/api/rounds/3/hint', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(r3HintRes.status, 200);

  // Second Round 3 hint is rejected
  const r3SecondRes = await request('/api/rounds/3/hint', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(r3SecondRes.status, 409);

  // Check Round 2 entitlement remains 1 and Round 3 entitlement remains 1
  const ent2 = await HintEntitlement.findOne({ teamId: teamA, round: 2 });
  const ent3 = await HintEntitlement.findOne({ teamId: teamA, round: 3 });
  assert.equal(ent2.hintsUsed, 1);
  assert.equal(ent3.hintsUsed, 1);
});

test('Round deadline enforcement: actions rejected once round has ended or expired', async () => {
  await startRound(2, 2700, 'admin');
  const cookieA = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: '{}',
  });

  // Admin ends Round 2 early
  await endRound(2, 'admin');

  // Submit clue returns 409 ROUND_NOT_ACTIVE
  const submitRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'ALPHA-RELAY-77' }),
  });
  assert.equal(submitRes.status, 409);

  // Hint returns 409 ROUND_NOT_RUNNING
  const hintRes = await request('/api/rounds/2/investigation/hint', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1 }),
  });
  assert.equal(hintRes.status, 409);
});

test('Cross-team isolation: Team B cannot see or alter Team A progress', async () => {
  await startRound(2, 2700, 'admin');
  const cookieA = await teamCookie(teamA);
  const cookieB = await teamCookie(teamB);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: '{}',
  });
  await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieA, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'ALPHA-RELAY-77' }),
  });

  const stateBRes = await request('/api/rounds/2/investigation/state', { headers: { cookie: cookieB } });
  const stateBData = await stateBRes.json();
  assert.equal(stateBData.status, 'not_started');

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieB, 'content-type': 'application/json' },
    body: '{}',
  });

  const stateARes = await request('/api/rounds/2/investigation/state', { headers: { cookie: cookieA } });
  const stateAData = await stateARes.json();
  assert.equal(stateAData.session.stage, 2);
});

test('Session independence: team playing investigation does not disturb admin session in same browser', async () => {
  await startRound(2, 2700, 'admin');
  const cookieAdmin = await adminCookie();
  const cookieTeam = await teamCookie(teamA);

  const adminRoundsRes = await request('/api/admin/rounds', { headers: { cookie: cookieAdmin } });
  assert.equal(adminRoundsRes.status, 200);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: '{}',
  });

  const adminCheck = await request('/api/admin/rounds', { headers: { cookie: cookieAdmin } });
  assert.equal(adminCheck.status, 200);
});

test('Hint failure handling: database error on GameSession rolls back HintEntitlement and allows clean retry', async () => {
  await startRound(2, 2700, 'admin');
  const cookieTeam = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: '{}',
  });

  // Temporarily stub GameSession.findOneAndUpdate to simulate transient DB write failure
  const originalFindOneAndUpdate = GameSession.findOneAndUpdate;
  let simulatedFailure = true;
  GameSession.findOneAndUpdate = async function (...args) {
    if (simulatedFailure && args[0]?._id) {
      simulatedFailure = false;
      throw new Error('Simulated transient database write collision');
    }
    return originalFindOneAndUpdate.apply(this, args);
  };

  try {
    const failedRes = await request('/api/rounds/2/investigation/hint', {
      method: 'POST',
      headers: { cookie: cookieTeam, 'content-type': 'application/json' },
      body: JSON.stringify({ stage: 1 }),
    });
    // Internal server error due to DB write failure
    assert.equal(failedRes.status, 500);

    // Verify compensating rollback: HintEntitlement must NOT be left consumed
    const danglingEntitlement = await HintEntitlement.findOne({ teamId: teamA, round: 2 });
    assert.equal(danglingEntitlement, null, 'HintEntitlement must be rolled back on session update failure');

    // Verify session progress did not record hint consumption
    const sessionDoc = await GameSession.findOne({ teamId: teamA, round: 2 });
    assert.equal(sessionDoc.progress?.hintsUsed || 0, 0);

    // Now retry when DB is operational: hint consumption must succeed cleanly
    const retryRes = await request('/api/rounds/2/investigation/hint', {
      method: 'POST',
      headers: { cookie: cookieTeam, 'content-type': 'application/json' },
      body: JSON.stringify({ stage: 1 }),
    });
    assert.equal(retryRes.status, 200);
    const retryData = await retryRes.json();
    assert.equal(retryData.hintsUsed, 1);
    assert.equal(retryData.penalty, 25);

    // Verify both documents are now in sync with hintsUsed: 1
    const finalEntitlement = await HintEntitlement.findOne({ teamId: teamA, round: 2 });
    const finalSession = await GameSession.findOne({ teamId: teamA, round: 2 });
    assert.equal(finalEntitlement.hintsUsed, 1);
    assert.equal(finalSession.progress.hintsUsed, 1);
  } finally {
    GameSession.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('Lead 1 regression: existing answer ALPHA-RELAY-77 and resource content remain strictly intact', async () => {
  await startRound(2, 2700, 'admin');
  const cookieTeam = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: '{}',
  });

  const clue1 = INVESTIGATION_CLUES.find((c) => c.stage === 1);
  assert.equal(clue1.expectedAnswer, 'ALPHA-RELAY-77');
  assert.equal(clue1.resource, '/investigation/resources/incident-log');
  assert.ok(clue1.prompt.includes('The alarm speaks of damage, but damage is only the end of a story'));

  const logRes = await request('/api/rounds/2/investigation/resources/incident-log', {
    headers: { cookie: cookieTeam },
  });
  assert.equal(logRes.status, 200);
  const logData = await logRes.json();
  assert.ok(logData.html.includes('X-Origin-Node: ALPHA-RELAY-77'));
  assert.ok(logData.html.includes('mock-log-table'));

  // Wrong answer is rejected
  const wrongRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'WRONG-ORIGIN-NODE' }),
  });
  assert.equal(wrongRes.status, 422);

  // Correct answer is accepted
  const correctRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'ALPHA-RELAY-77' }),
  });
  assert.equal(correctRes.status, 200);
});

test('Lead 2 redesign: accepts FRAME-SHIFT-246, rejects old SEC-VAULT-909, and resource embeds evidence board', async () => {
  await startRound(2, 2700, 'admin');
  const cookieTeam = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: '{}',
  });
  await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'ALPHA-RELAY-77' }),
  });

  const clue2 = INVESTIGATION_CLUES.find((c) => c.stage === 2);
  assert.equal(clue2.expectedAnswer, 'FRAME-SHIFT-246');
  assert.ok(clue2.prompt.includes('Three records describe the same moment, yet their stories refuse to agree'));

  const advisoryRes = await request('/api/rounds/2/investigation/resources/advisory', {
    headers: { cookie: cookieTeam },
  });
  assert.equal(advisoryRes.status, 200);
  const advisoryData = await advisoryRes.json();
  assert.ok(advisoryData.html.includes('FRAME-SHIFT-246'));
  assert.ok(advisoryData.html.includes('Three records describe the same moment'));
  assert.ok(advisoryData.html.includes('DFU-REP-2026-042'));
  assert.ok(advisoryData.html.includes('doc-forensic-report.svg'));
  assert.ok(advisoryData.html.includes('cctv-server-rack.jpg'));

  // Old answer must be rejected
  const oldRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 2, answer: 'SEC-VAULT-909' }),
  });
  assert.equal(oldRes.status, 422);

  // New answer accepted and unlocks Lead 3
  const newRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 2, answer: 'FRAME-SHIFT-246' }),
  });
  assert.equal(newRes.status, 200);
  const submitData = await newRes.json();
  assert.equal(submitData.stage, 3);

  // Lead 3 resource is now accessible
  const terminalRes = await request('/api/rounds/2/investigation/resources/terminal', {
    headers: { cookie: cookieTeam },
  });
  assert.equal(terminalRes.status, 200);

  // Verify all 13 forensic assets exist locally in public/assets/forensic/
  const forensicDir = path.resolve(__dirname, '../../public/assets/forensic');
  const expectedAssets = [
    'doc-incident-timeline.svg',
    'cctv-server-rack.jpg',
    'cctv-corridor.jpg',
    'doc-access-logs.svg',
    'doc-network-flow.svg',
    'doc-forensic-report.svg',
    'hardware-network-tap.jpg',
    'hardware-tamper-switch.jpg',
    'smartcard-badge-bag.jpg',
    'doc-officer-statement.svg',
    'doc-investigator-notes.svg',
    'doc-evidence-inventory.svg',
    'doc-floorplan-topology.svg',
  ];
  for (const asset of expectedAssets) {
    const fullPath = path.join(forensicDir, asset);
    assert.ok(fs.existsSync(fullPath), `Forensic asset ${asset} must exist locally`);
  }

  // Verify doc-forensic-report.svg contains the canonical answer
  const forensicReportSvg = fs.readFileSync(path.join(forensicDir, 'doc-forensic-report.svg'), 'utf8');
  assert.ok(forensicReportSvg.includes('FRAME-SHIFT-246'));

  // Verify production bundle does not leak canonical answer
  const distDir = path.resolve(__dirname, '../../dist/assets');
  if (fs.existsSync(distDir)) {
    const jsFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
    for (const jsFile of jsFiles) {
      const jsContent = fs.readFileSync(path.join(distDir, jsFile), 'utf8');
      assert.ok(!jsContent.includes('FRAME-SHIFT-246'), `Production JS bundle ${jsFile} must not leak FRAME-SHIFT-246`);
    }
  }
});

test('Lead 3 redesign: accepts hellowor!d, rejects old REWIND-KEY-731 and SHADOW-KEY-418, and resource links CyberHint repository', async () => {
  await startRound(2, 2700, 'admin');
  const cookieTeam = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: '{}',
  });
  await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'ALPHA-RELAY-77' }),
  });
  await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 2, answer: 'FRAME-SHIFT-246' }),
  });

  const clue3 = INVESTIGATION_CLUES.find((c) => c.stage === 3);
  assert.equal(clue3.expectedAnswer, 'hellowor!d');
  assert.ok(clue3.prompt.includes('The latest record appears innocent'));

  const terminalRes = await request('/api/rounds/2/investigation/resources/terminal', {
    headers: { cookie: cookieTeam },
  });
  assert.equal(terminalRes.status, 200);
  const terminalData = await terminalRes.json();
  assert.ok(terminalData.html.includes('The latest record appears innocent'));
  assert.ok(terminalData.html.includes('campus-relay-telemetry'));
  assert.ok(terminalData.html.includes('https://github.com/DDuggad/CyberHint'));

  // Old answers must be rejected
  const oldRes1 = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 3, answer: 'SHADOW-KEY-418' }),
  });
  assert.equal(oldRes1.status, 422);

  const oldRes2 = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 3, answer: 'REWIND-KEY-731' }),
  });
  assert.equal(oldRes2.status, 422);

  // New answer accepted
  const newRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 3, answer: 'hellowor!d' }),
  });
  assert.equal(newRes.status, 200);
});

test('Lead 4 redesign: accepts UNMASKED, rejects invalid answers, and resource provides signal reconstruction', async () => {
  await startRound(2, 2700, 'admin');
  const cookieTeam = await teamCookie(teamA);

  await request('/api/rounds/2/investigation/start', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: '{}',
  });
  await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 1, answer: 'ALPHA-RELAY-77' }),
  });
  await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 2, answer: 'FRAME-SHIFT-246' }),
  });
  await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 3, answer: 'hellowor!d' }),
  });

  const clue4 = INVESTIGATION_CLUES.find((c) => c.stage === 4);
  assert.equal(clue4.expectedAnswer, 'UNMASKED');
  assert.ok(clue4.prompt.includes('The vault has kept the truth in fragments'));

  const vaultRes = await request('/api/rounds/2/investigation/resources/vault', {
    headers: { cookie: cookieTeam },
  });
  assert.equal(vaultRes.status, 200);
  const vaultData = await vaultRes.json();
  assert.ok(vaultData.html.includes('The vault has kept the truth in fragments'));
  assert.ok(vaultData.html.includes('Signal Reconstruction'));

  // Old answer must be rejected
  const oldRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 4, answer: 'CC{DOM_SLEUTH_N3TW0RK_941}' }),
  });
  assert.equal(oldRes.status, 422);

  // New answer accepted
  const newRes = await request('/api/rounds/2/investigation/submit', {
    method: 'POST',
    headers: { cookie: cookieTeam, 'content-type': 'application/json' },
    body: JSON.stringify({ stage: 4, answer: 'UNMASKED' }),
  });
  assert.equal(newRes.status, 200);
  const newData = await newRes.json();
  assert.equal(newData.completed, true);
});
