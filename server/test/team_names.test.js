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
const adminUsername = `nameadmin${process.pid}`;
const adminPassword = 'NameAdminPassword123';
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

test('name with leading/trailing spaces is stored trimmed', async () => {
  const cookie = await adminCookie();
  const rawName = `   Cyber Knights ${suffix}   `;
  const expectedName = `Cyber Knights ${suffix}`;
  const res = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: rawName }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  createdTeamIds.push(data.team.teamId);

  assert.equal(data.team.name, expectedName);
  const stored = await Team.findOne({ teamId: data.team.teamId }).lean();
  assert.equal(stored.name, expectedName);
});

test('two inner spaces collapse to one', async () => {
  const cookie = await adminCookie();
  const rawName = `Alpha   Bravo  Charlie ${suffix}`;
  const expectedName = `Alpha Bravo Charlie ${suffix}`;
  const res = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: rawName }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  createdTeamIds.push(data.team.teamId);

  assert.equal(data.team.name, expectedName);
  const stored = await Team.findOne({ teamId: data.team.teamId }).lean();
  assert.equal(stored.name, expectedName);
});

test('a 41-character name is rejected with a clear error (not truncated)', async () => {
  const cookie = await adminCookie();
  const name41 = 'A'.repeat(41);
  const res = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: name41 }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error);
  assert.match(data.error, /40/i);

  // Verify it was not stored or truncated in DB
  const stored = await Team.findOne({ name: name41 }).lean();
  assert.equal(stored, null);
  const truncated = await Team.findOne({ name: 'A'.repeat(40) }).lean();
  assert.equal(truncated, null);
});

test('duplicate names differing only in case are rejected', async () => {
  const cookie = await adminCookie();
  const originalName = `Delta Force ${suffix}`;
  const res1 = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: originalName }),
  });
  assert.equal(res1.status, 201);
  const data1 = await res1.json();
  createdTeamIds.push(data1.team.teamId);

  // Attempt duplicate differing only in case
  const lowerName = originalName.toLowerCase();
  const res2 = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: lowerName }),
  });
  assert.equal(res2.status, 400);
  const data2 = await res2.json();
  assert.match(data2.error, /already exists/i);

  // Attempt duplicate via PATCH on a different team
  const resOther = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: `Other Team ${suffix}` }),
  });
  assert.equal(resOther.status, 201);
  const dataOther = await resOther.json();
  createdTeamIds.push(dataOther.team.teamId);

  const patchRes = await request(`/api/admin/teams/${dataOther.team.teamId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: originalName.toUpperCase() }),
  });
  assert.equal(patchRes.status, 400);
  const patchData = await patchRes.json();
  assert.match(patchData.error, /already exists/i);
});

test('the response name equals the stored name', async () => {
  const cookie = await adminCookie();
  const rawName = `   Echo   Squadron   7   ${suffix}   `;
  const expectedName = `Echo Squadron 7 ${suffix}`;
  const res = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: rawName }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  createdTeamIds.push(data.team.teamId);

  const stored = await Team.findOne({ teamId: data.team.teamId }).lean();
  assert.equal(data.team.name, expectedName);
  assert.equal(stored.name, expectedName);
  assert.equal(data.team.name, stored.name);

  // Verify on PATCH as well
  const patchRes = await request(`/api/admin/teams/${data.team.teamId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: `  Echo  Updated  ${suffix}  ` }),
  });
  assert.equal(patchRes.status, 200);
  const patchData = await patchRes.json();
  const updatedStored = await Team.findOne({ teamId: data.team.teamId }).lean();
  assert.equal(patchData.team.name, `Echo Updated ${suffix}`);
  assert.equal(updatedStored.name, `Echo Updated ${suffix}`);
  assert.equal(patchData.team.name, updatedStored.name);
});

test('the leaderboard shows the new name', async () => {
  const cookie = await adminCookie();
  const initialName = `Leader Initial ${suffix}`;
  const updatedName = `Leader Renamed ${suffix}`;

  const res = await request('/api/admin/teams', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: initialName }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  createdTeamIds.push(data.team.teamId);

  // Check initial leaderboard
  const lbRes1 = await request('/api/leaderboard');
  assert.equal(lbRes1.status, 200);
  const lbData1 = await lbRes1.json();
  const row1 = lbData1.rows.find((r) => r.name === initialName);
  assert.ok(row1, `Expected leaderboard to include ${initialName}`);

  // Rename team
  const patchRes = await request(`/api/admin/teams/${data.team.teamId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: updatedName }),
  });
  assert.equal(patchRes.status, 200);

  // Immediately request leaderboard to verify invalidation delivers fresh name
  const lbRes2 = await request('/api/leaderboard');
  assert.equal(lbRes2.status, 200);
  const lbData2 = await lbRes2.json();
  const oldRow = lbData2.rows.find((r) => r.name === initialName);
  const newRow = lbData2.rows.find((r) => r.name === updatedName);
  assert.equal(oldRow, undefined, 'Old team name should not appear on leaderboard');
  assert.ok(newRow, `Expected leaderboard to show updated name ${updatedName}`);
});
