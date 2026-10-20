import './bootstrap.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { Admin } from '../src/models/Admin.js';
import { EventLog } from '../src/models/EventLog.js';
import { Team } from '../src/models/Team.js';
import { TeamProgression } from '../src/models/TeamProgression.js';
import { sessionStore } from '../src/sessionStore.js';
import { hashPassword } from '../src/utils/passwords.js';

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const adminUsername = `pwadmin${process.pid}`;
const adminPassword = 'PasswordAdminSecret123';
const createdTeamIds = [];
let server;
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

async function loginTeam(teamId, password) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamId, password }),
  });
}

before(async () => {
  await connectDatabase();
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
  if (createdTeamIds.length) {
    await Team.deleteMany({ teamId: { $in: createdTeamIds } });
    await TeamProgression.deleteMany({ teamId: { $in: createdTeamIds } });
  }
  await Admin.deleteOne({ username: adminUsername });
  await EventLog.deleteMany({ actorId: adminUsername });
  await sessionStore.close();
  await disconnectDatabase();
});

test('login works with exactly the chosen password', async () => {
  const cookie = await adminCookie();
  const chosenPassword = 'CustomSecretPass2026!';
  const teamName = `Chosen Pw Team ${suffix}`;

  const res = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: teamName,
      password: chosenPassword,
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  const teamId = data.team.teamId;
  createdTeamIds.push(teamId);

  // Login with correct chosen password
  const loginRes = await loginTeam(teamId, chosenPassword);
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.equal(loginData.team.teamId, teamId);

  // Login with wrong password fails
  const wrongRes = await loginTeam(teamId, 'IncorrectPass123!');
  assert.equal(wrongRes.status, 401);
});

test("weak ones (too short, contains team ID, contains team name, 'aaaaaaaaaa', 'password123') get 400", async () => {
  const cookie = await adminCookie();
  const teamName = `Weak Pw Team ${suffix}`;

  // 1. Too short (< 10 chars)
  const shortRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: `${teamName} 1`, password: 'short' }),
  });
  assert.equal(shortRes.status, 400);

  // 2. Contains team name (case-insensitive)
  const team2Name = `WeakTeamTwo${suffix}`;
  const nameContainRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: team2Name, password: `Secret${team2Name.toLowerCase()}Pass` }),
  });
  assert.equal(nameContainRes.status, 400);

  // 3. Repeated single character ('aaaaaaaaaa')
  const repeatedRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: `${teamName} 3`, password: 'aaaaaaaaaa' }),
  });
  assert.equal(repeatedRes.status, 400);

  // 4. Obvious sequence ('password123')
  const sequenceRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: `${teamName} 4`, password: 'password123' }),
  });
  assert.equal(sequenceRes.status, 400);

  // 5. Contains team ID on reset-password
  // Create a valid team first
  const resetTargetName = `TargetBeacon${suffix}`;
  const validRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: resetTargetName }),
  });
  assert.equal(validRes.status, 201);
  const validData = await validRes.json();
  const validId = validData.team.teamId;
  createdTeamIds.push(validId);

  // Reset with password containing teamId
  const teamIdContainRes = await request(`/api/admin/teams/${validId}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ password: `Secret_${validId.toLowerCase()}_Pass` }),
  });
  assert.equal(teamIdContainRes.status, 400);

  // Reset with password containing team name
  const teamNameResetRes = await request(`/api/admin/teams/${validId}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ password: `Secret_${resetTargetName.toLowerCase()}_Pass` }),
  });
  assert.equal(teamNameResetRes.status, 400);
});

test('a custom-password response has no password field', async () => {
  const cookie = await adminCookie();
  const customPassword = 'ValidStrongCustomPassword#99';

  // Test create response
  const createRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: `No Mask Team ${suffix}`,
      password: customPassword,
    }),
  });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.headers.get('cache-control'), 'no-store');
  const createData = await createRes.json();
  const teamId = createData.team.teamId;
  createdTeamIds.push(teamId);

  assert.equal('password' in createData, false);
  assert.equal(createData.password, undefined);
  assert.equal(createData.passwordSet, true);

  // Test reset response
  const resetRes = await request(`/api/admin/teams/${teamId}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ password: 'AnotherStrongPassword2026!' }),
  });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.headers.get('cache-control'), 'no-store');
  const resetData = await resetRes.json();

  assert.equal('password' in resetData, false);
  assert.equal(resetData.password, undefined);
  assert.equal(resetData.passwordSet, true);
  assert.equal(resetData.teamId, teamId);
});

test('the generated flow is unchanged', async () => {
  const cookie = await adminCookie();

  // 1. Create with omitted password
  const createRes1 = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: `Gen Flow 1 ${suffix}` }),
  });
  assert.equal(createRes1.status, 201);
  assert.equal(createRes1.headers.get('cache-control'), 'no-store');
  const data1 = await createRes1.json();
  const teamId1 = data1.team.teamId;
  createdTeamIds.push(teamId1);
  assert.equal(typeof data1.password, 'string');
  assert.equal(data1.password.length, 12);

  // Login works with generated password
  const loginRes1 = await loginTeam(teamId1, data1.password);
  assert.equal(loginRes1.status, 200);

  // 2. Create with empty string password
  const createRes2 = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: `Gen Flow 2 ${suffix}`, password: '' }),
  });
  assert.equal(createRes2.status, 201);
  const data2 = await createRes2.json();
  const teamId2 = data2.team.teamId;
  createdTeamIds.push(teamId2);
  assert.equal(typeof data2.password, 'string');
  assert.equal(data2.password.length, 12);

  // 3. Reset password with empty body
  const resetRes = await request(`/api/admin/teams/${teamId1}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({}),
  });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.headers.get('cache-control'), 'no-store');
  const resetData = await resetRes.json();
  assert.equal(typeof resetData.password, 'string');
  assert.equal(resetData.password.length, 12);

  // Login works with new generated password
  const loginResAfterReset = await loginTeam(teamId1, resetData.password);
  assert.equal(loginResAfterReset.status, 200);
});

test('reset with a custom password kills the old session', async () => {
  const cookie = await adminCookie();
  const initialPassword = 'InitialCustomPass#123';
  const newPassword = 'NewCustomPass#456';

  const createRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: `Kill Session Team ${suffix}`,
      password: initialPassword,
    }),
  });
  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  const teamId = createData.team.teamId;
  createdTeamIds.push(teamId);

  // Log in as team to establish session
  const loginRes = await loginTeam(teamId, initialPassword);
  assert.equal(loginRes.status, 200);
  const teamCookie = loginRes.headers.get('set-cookie').split(';', 1)[0];

  // Verify session works
  const sessionCheckBefore = await request('/api/team/score', {
    headers: { cookie: teamCookie },
  });
  assert.equal(sessionCheckBefore.status, 200);

  // Admin resets password with custom password
  const resetRes = await request(`/api/admin/teams/${teamId}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ password: newPassword }),
  });
  assert.equal(resetRes.status, 200);

  // Previous session cookie is now rejected with 401
  const sessionCheckAfter = await request('/api/team/score', {
    headers: { cookie: teamCookie },
  });
  assert.equal(sessionCheckAfter.status, 401);

  // Old password no longer works
  const oldLoginRes = await loginTeam(teamId, initialPassword);
  assert.equal(oldLoginRes.status, 401);

  // New custom password works
  const newLoginRes = await loginTeam(teamId, newPassword);
  assert.equal(newLoginRes.status, 200);
});

test('audit entries contain no password or hash', async () => {
  const cookie = await adminCookie();
  const secretPassword = 'MySecretCustomPass2026#';

  const latest = await Team.findOne().sort({ teamId: -1 }).select('teamId').lean();
  const nextNum = latest ? Number(latest.teamId.slice(3)) + 1 : 1;
  const expectedTeamId = `CC-${String(nextNum).padStart(3, '0')}`;
  await EventLog.deleteMany({ teamId: expectedTeamId });

  const createRes = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: `Audit Test Team ${suffix}`,
      password: secretPassword,
    }),
  });
  assert.equal(createRes.status, 201);
  const createData = await createRes.json();
  const teamId = createData.team.teamId;
  createdTeamIds.push(teamId);

  const resetRes = await request(`/api/admin/teams/${teamId}/reset-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ password: 'AnotherSecretPass2026#' }),
  });
  assert.equal(resetRes.status, 200);

  // Inspect EventLog entries for this team
  const logs = await EventLog.find({ teamId }).lean();
  assert.ok(logs.length >= 2);

  for (const log of logs) {
    const serialized = JSON.stringify(log);
    // Never contains the clear text passwords
    assert.equal(serialized.includes(secretPassword), false);
    assert.equal(serialized.includes('AnotherSecretPass2026#'), false);
    // Never contains bcrypt hashes
    assert.doesNotMatch(serialized, /\$2[aby]\$\d+\$/);
    // Never contains fields named password or hash
    assert.equal('password' in (log.details || {}), false);
    assert.equal('passwordHash' in (log.details || {}), false);
    assert.equal('hash' in (log.details || {}), false);
  }

  const passwordLogs = logs.filter((l) => ['team created', 'password reset'].includes(l.type));
  assert.equal(passwordLogs.length, 2);
  for (const log of passwordLogs) {
    assert.ok(log.details.credentialSource === 'custom' || log.details.credentialSource === 'generated');
  }
});

test('a failed validation leaves no half-created team', async () => {
  const cookie = await adminCookie();
  const teamsBefore = await Team.countDocuments();
  const teamName = `Fail Val Team ${suffix}`;

  const res = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: teamName,
      password: 'password123',
    }),
  });
  assert.equal(res.status, 400);

  const teamsAfter = await Team.countDocuments();
  assert.equal(teamsAfter, teamsBefore);

  const check = await Team.findOne({ name: teamName }).lean();
  assert.equal(check, null);
});
