import './bootstrap.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { Admin } from '../src/models/Admin.js';
import { EventLog } from '../src/models/EventLog.js';
import { Team } from '../src/models/Team.js';
import { destroyTeamSessions, sessionStore } from '../src/sessionStore.js';
import { clearTeamLoginLockout } from '../src/routes/auth.js';
import { comparePassword, hashPassword } from '../src/utils/passwords.js';

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const teamId = `CC-${suffix}`;
const adminUsername = `authadmin${process.pid}`;
const teamPassword = 'AuthTeamPassword123';
const adminPassword = 'AuthAdminPassword123';
let server;
let baseUrl;
let createdTeamId;

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function login(credentials, cookie) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(credentials),
  });
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

function assertNoCredentialFields(value, forbiddenStrings = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => assertNoCredentialFields(item, forbiddenStrings));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    assert.doesNotMatch(key.toLowerCase(), /password|hash/);
    assertNoCredentialFields(item, forbiddenStrings);
  }
  const serialized = JSON.stringify(value);
  for (const forbidden of forbiddenStrings) {
    assert.equal(serialized.includes(forbidden), false);
  }
}

before(async () => {
  await connectDatabase();
  await Team.create({
    teamId,
    name: 'Auth Test Team',
    passwordHash: await hashPassword(teamPassword),
  });
  await Admin.create({
    username: adminUsername,
    passwordHash: await hashPassword(adminPassword),
  });
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await Team.deleteMany({ teamId: { $in: [teamId, createdTeamId].filter(Boolean) } });
  await Admin.deleteOne({ username: adminUsername });
  await EventLog.deleteMany({ $or: [{ teamId }, { actorId: adminUsername }] });
  await sessionStore.close();
  await disconnectDatabase();
});

test('wrong team ID and wrong password return the identical generic error', async () => {
  const wrongPassword = await login({ teamId, password: 'IncorrectTeamPassword123' });
  const wrongTeam = await login({ teamId: 'CC-999999999999', password: teamPassword });
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongTeam.status, 401);
  const wrongPasswordBody = await wrongPassword.json();
  const wrongTeamBody = await wrongTeam.json();
  assert.deepEqual(wrongPasswordBody, wrongTeamBody);
  assert.deepEqual(wrongPasswordBody, { error: 'Invalid credentials' });
});

test('team login enforces input caps and omits credential fields', async () => {
  const maximumId = await login({ teamId: `CC-${'1'.repeat(17)}`, password: 'x'.repeat(128) });
  const longId = await login({ teamId: `CC-${'1'.repeat(18)}`, password: teamPassword });
  const longPassword = await login({ teamId, password: 'x'.repeat(129) });
  assert.equal(maximumId.status, 401);
  assert.equal(longId.status, 400);
  assert.equal(longPassword.status, 400);

  const response = await login({ teamId, password: teamPassword });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, { role: 'team', team: { teamId, name: 'Auth Test Team' } });
  assertNoCredentialFields(payload, [teamPassword]);
});

test('new login regenerates the session and destroys the previous team session', async () => {
  const firstLogin = await login({ teamId, password: teamPassword });
  const firstCookie = firstLogin.headers.get('set-cookie').split(';', 1)[0];
  const secondLogin = await login({ teamId, password: teamPassword }, firstCookie);
  const secondCookie = secondLogin.headers.get('set-cookie').split(';', 1)[0];
  assert.notEqual(secondCookie, firstCookie);

  const oldSessionResponse = await request('/api/auth/me', { headers: { cookie: firstCookie } });
  assert.equal(oldSessionResponse.status, 401);
  const currentSessionResponse = await request('/api/auth/me', { headers: { cookie: secondCookie } });
  assert.equal(currentSessionResponse.status, 200);
});

test('disabled team sessions receive 401 on their next request', async () => {
  const cookie = (await login({ teamId, password: teamPassword }))
    .headers.get('set-cookie').split(';', 1)[0];
  const response = await request(`/api/admin/teams/${teamId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      cookie: await adminCookie(),
    },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(response.status, 200);
  const nextRequest = await request('/api/team/me', { headers: { cookie } });
  assert.equal(nextRequest.status, 401);
  await Team.updateOne({ teamId }, { $set: { active: true } });
});

test('team sessions cannot access admin routes', async () => {
  const cookie = (await login({ teamId, password: teamPassword }))
    .headers.get('set-cookie').split(';', 1)[0];
  const response = await request('/api/admin/teams', { headers: { cookie } });
  assert.equal(response.status, 403);
});

test('create and reset issue one password without returning hashes', async () => {
  const cookie = await adminCookie();
  const createResponse = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'One Login Team' }),
  });
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.headers.get('cache-control'), 'no-store');
  const created = await createResponse.json();
  createdTeamId = created.team.teamId;
  assert.deepEqual(Object.keys(created).sort(), ['password', 'team']);
  assert.match(created.password, /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{12}$/);
  assertNoCredentialFields(created.team);

  const storedTeam = await Team.findOne({ teamId: createdTeamId }).select('+passwordHash').lean();
  assert.ok(storedTeam.passwordHash);
  assert.equal(await comparePassword(created.password, storedTeam.passwordHash), true);

  const resetResponse = await request(`/api/admin/teams/${createdTeamId}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({}),
  });
  assert.equal(resetResponse.status, 200);
  assert.equal(resetResponse.headers.get('cache-control'), 'no-store');
  const reset = await resetResponse.json();
  assert.deepEqual(Object.keys(reset).sort(), ['password', 'teamId']);
  assert.match(reset.password, /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{12}$/);

  const staleSession = await login({ teamId: createdTeamId, password: created.password });
  assert.equal(staleSession.status, 401);
  const newSession = await login({ teamId: createdTeamId, password: reset.password });
  assert.equal(newSession.status, 200);
});

test('team creation rolls back if audit logging fails', async () => {
  const cookie = await adminCookie();
  const originalCreate = EventLog.create;
  const originalConsoleError = console.error;
  const loggedErrors = [];
  EventLog.create = async () => {
    throw new Error('injected audit failure');
  };
  console.error = (...args) => loggedErrors.push(args);
  try {
    const response = await request('/api/admin/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'Must Roll Back' }),
    });
    assert.equal(response.status, 500);
    const leakedTeam = await Team.findOne({ name: 'Must Roll Back' });
    assert.equal(leakedTeam, null);
  } finally {
    EventLog.create = originalCreate;
    console.error = originalConsoleError;
  }
  assert.ok(loggedErrors.some(([error]) => error?.message === 'injected audit failure'));
});

test('creating a team with biasPoints returns 400', async () => {
  const cookie = await adminCookie();
  const response = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'Rejected Bias Team', biasPoints: 50 }),
  });
  assert.equal(response.status, 400);
});

test('team, score and admin listing responses never expose credential fields', async () => {
  await Team.updateOne({ teamId }, { $set: { active: true } });
  const teamCookie = (await login({ teamId, password: teamPassword }))
    .headers.get('set-cookie').split(';', 1)[0];
  const admin = await adminCookie();

  for (const [path, cookie] of [
    ['/api/auth/me', teamCookie],
    ['/api/team/me', teamCookie],
    ['/api/team/score', teamCookie],
    ['/api/admin/teams', admin],
    ['/api/admin/scores', admin],
    ['/api/admin/logs', admin],
  ]) {
    const response = await request(path, { headers: { cookie } });
    assert.equal(response.status, 200, path);
    assertNoCredentialFields(await response.json(), [teamPassword, adminPassword]);
  }
});

test('team A lockout is isolated from team B and the admin login on the same IP', async () => {
  const teamBId = `CC-${suffix}1`;
  await Team.create({
    teamId: teamBId,
    name: 'Auth Isolation Team B',
    passwordHash: await hashPassword(teamPassword),
  });
  await clearTeamLoginLockout(teamId);

  try {
    const statuses = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await login({ teamId, password: 'IncorrectTeamPassword123' });
      statuses.push(response.status);
      await response.arrayBuffer();
    }
    assert.ok(statuses.includes(429), 'team A should become rate limited');
    assert.ok(statuses.every((status) => status === 401 || status === 429));

    const teamBResponse = await login({ teamId: teamBId, password: teamPassword });
    assert.equal(teamBResponse.status, 200);
    const adminResponse = await request('/api/auth/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: adminUsername, password: adminPassword }),
    });
    assert.equal(adminResponse.status, 200);

    const correctPasswordDuringLockout = await login({ teamId, password: teamPassword });
    assert.equal(correctPasswordDuringLockout.status, 429);
  } finally {
    await clearTeamLoginLockout(teamId);
    await destroyTeamSessions(teamBId);
    await Team.deleteOne({ teamId: teamBId });
  }
});

test('20 different teams can successfully log in from the same IP', async () => {
  const manyTeamIds = Array.from({ length: 20 }, (_, index) => `CC-${suffix}${index + 2}`);
  const password = 'SharedLoadTestPassword123';
  const passwordHash = await hashPassword(password);
  await Team.insertMany(manyTeamIds.map((id) => ({
    teamId: id,
    name: `Login load team ${id}`,
    passwordHash,
  })));

  try {
    const statuses = [];
    for (const id of manyTeamIds) {
      const response = await login({ teamId: id, password });
      statuses.push(response.status);
      await response.arrayBuffer();
    }
    assert.deepEqual(statuses, Array(20).fill(200));
  } finally {
    await Promise.all(manyTeamIds.map((id) => destroyTeamSessions(id)));
    await Team.deleteMany({ teamId: { $in: manyTeamIds } });
  }
});

test('admin and team sessions are independent and coexist in the same cookie jar', async () => {
  await Team.updateOne({ teamId }, { $set: { active: true } });

  // 1. Team logs in -> gets cc_team.sid
  const teamLoginRes = await login({ teamId, password: teamPassword });
  assert.equal(teamLoginRes.status, 200);
  const teamSetCookie = teamLoginRes.headers.get('set-cookie');
  assert.ok(teamSetCookie.includes('cc_team.sid'));
  const teamCookie = teamSetCookie.split(';', 1)[0];

  // 2. Admin logs in -> gets cc_admin.sid
  const adminCookieStr = await adminCookie();
  assert.ok(adminCookieStr.includes('cc_admin.sid'));

  // 3. Simulated browser cookie jar: contains BOTH cookies
  const combinedJar = `${teamCookie}; ${adminCookieStr}`;

  // 4. Team me returns authenticated team using combined jar
  const teamMeRes = await request('/api/team/me', { headers: { cookie: combinedJar } });
  assert.equal(teamMeRes.status, 200);
  const teamMe = await teamMeRes.json();
  assert.equal(teamMe.teamId, teamId);

  // 5. Admin teams returns 200 using combined jar
  const adminTeamsRes = await request('/api/admin/teams', { headers: { cookie: combinedJar } });
  assert.equal(adminTeamsRes.status, 200);

  // 6. Admin identity checks (/api/admin/rounds, /api/auth/me) succeed
  const adminRoundsRes = await request('/api/admin/rounds', { headers: { cookie: combinedJar } });
  assert.equal(adminRoundsRes.status, 200);
  const adminMeRes = await request('/api/auth/me', {
    headers: { cookie: combinedJar, 'x-session-role': 'admin' },
  });
  assert.equal(adminMeRes.status, 200);
  const adminMe = await adminMeRes.json();
  assert.equal(adminMe.role, 'admin');

  // 7. Isolation check: Team session alone CANNOT access admin routes
  const teamOnlyAdminAccess = await request('/api/admin/teams', { headers: { cookie: teamCookie } });
  assert.equal(teamOnlyAdminAccess.status, 403);

  // 8. Isolation check: Admin session alone CANNOT access private team resources
  const adminOnlyTeamAccess = await request('/api/team/me', { headers: { cookie: adminCookieStr } });
  assert.equal(adminOnlyTeamAccess.status, 401);

  // 9. Admin logout does NOT invalidate team session
  const adminLogoutRes = await request('/api/auth/logout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: combinedJar, 'x-session-role': 'admin' },
    body: JSON.stringify({ role: 'admin' }),
  });
  assert.equal(adminLogoutRes.status, 204);
  const clearCookieHeader = adminLogoutRes.headers.get('set-cookie');
  assert.ok(clearCookieHeader.includes('cc_admin.sid'));

  // Team session is still valid!
  const teamStillActive = await request('/api/team/me', { headers: { cookie: teamCookie } });
  assert.equal(teamStillActive.status, 200);

  // 10. Re-login as admin, then team logout does NOT invalidate admin session
  const newAdminCookie = await adminCookie();
  const newCombinedJar = `${teamCookie}; ${newAdminCookie}`;

  const teamLogoutRes = await request('/api/auth/logout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: newCombinedJar, 'x-session-role': 'team' },
    body: JSON.stringify({ role: 'team' }),
  });
  assert.equal(teamLogoutRes.status, 204);

  // Team session is now invalidated
  const teamLoggedOut = await request('/api/team/me', { headers: { cookie: teamCookie } });
  assert.equal(teamLoggedOut.status, 401);

  // Admin session is STILL valid!
  const adminStillActive = await request('/api/admin/teams', { headers: { cookie: newAdminCookie } });
  assert.equal(adminStillActive.status, 200);
});
