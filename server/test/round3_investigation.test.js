import "./bootstrap.js";
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { connectDatabase, disconnectDatabase } from "../src/db.js";
import { createApp } from "../src/app.js";
import { sessionStore } from "../src/sessionStore.js";
import { InvestigationCase } from "../src/models/InvestigationCase.js";
import { Admin } from "../src/models/Admin.js";
import { RoundState } from "../src/models/RoundState.js";
import { Team } from "../src/models/Team.js";
import {
  endRound,
  initializeRoundStates,
  pauseRound,
  startRound,
} from "../src/services/roundState.js";
import { hashPassword } from "../src/utils/passwords.js";

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const teamId = `CC-93${suffix}`;
const password = "InvestigationBranchTestPassword123";
const adminUsername = `investigationadmin${suffix}`;
const adminPassword = "InvestigationAdminPassword123";
let server;
let baseUrl;

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function login() {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ teamId, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";", 1)[0];
}

async function adminLogin() {
  const response = await request("/api/auth/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";", 1)[0];
}

function post(path, body, cookie) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return request(path, { method: "POST", headers, body: JSON.stringify(body) });
}

async function joinDetective(cookie) {
  return post("/api/investigation/join", {}, cookie);
}

async function joinAnalyst(invite) {
  return post("/api/investigation/join/analyst", { invite });
}

async function getCase() {
  const state = await RoundState.findOne({ round: 3 })
    .select("+investigations.inviteHash")
    .lean();
  return (
    state?.investigations?.find((entry) => entry.teamId === teamId) || null
  );
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function holdNextAggregateAdmission({ afterWrite = false } = {}) {
  const original = RoundState.findOneAndUpdate;
  const entered = deferred();
  const release = deferred();
  let intercepted = false;
  RoundState.findOneAndUpdate = function (filter, update, options) {
    const isAdmission =
      filter?.round === 3 &&
      filter.status === "running" &&
      filter.$expr?.$gt &&
      (filter.investigations?.$elemMatch ||
        filter.investigations?.$not?.$elemMatch);
    if (!intercepted && isAdmission) {
      intercepted = true;
      RoundState.findOneAndUpdate = original;
      const query = original.call(RoundState, filter, update, options);
      const execute = query.exec.bind(query);
      query.exec = async (...args) => {
        if (afterWrite) {
          const result = await execute(...args);
          entered.resolve();
          await release.promise;
          return result;
        }
        entered.resolve();
        await release.promise;
        return execute(...args);
      };
      return query;
    }
    return original.call(RoundState, filter, update, options);
  };
  return {
    entered: entered.promise,
    release: release.resolve,
    restore() {
      RoundState.findOneAndUpdate = original;
    },
  };
}

before(async () => {
  await connectDatabase();
  await Team.create({
    teamId,
    name: `Test ${teamId}`,
    passwordHash: await hashPassword(password),
  });
  await Admin.create({
    username: adminUsername,
    passwordHash: await hashPassword(adminPassword),
  });
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await InvestigationCase.deleteMany({ teamId });
  await RoundState.deleteMany({ round: 3 });
  await initializeRoundStates();
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await InvestigationCase.deleteMany({ teamId });
  await Team.deleteMany({ teamId });
  await Admin.deleteOne({ username: adminUsername });
  await RoundState.deleteMany({ round: 3 });
  await sessionStore.close();
  await disconnectDatabase();
});

test("detective and analyst roles are claimed once with the existing invite contract", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const prototypePreflight = await request("/api/investigation/join", {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:5177",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  assert.equal(prototypePreflight.status, 204);
  assert.equal(
    prototypePreflight.headers.get("access-control-allow-origin"),
    "http://localhost:5177",
  );

  const detectiveCookie = await login();
  const claims = await Promise.all([
    joinDetective(detectiveCookie),
    joinDetective(detectiveCookie),
  ]);
  assert.deepEqual(
    claims.map((response) => response.status).sort(),
    [201, 409],
  );
  const joined = await claims
    .find((response) => response.status === 201)
    .json();
  assert.ok(joined.analystInvite);
  assert.equal(joined.state.role, "detective");

  const analystClaims = await Promise.all([
    joinAnalyst(joined.analystInvite),
    joinAnalyst(joined.analystInvite),
  ]);
  assert.deepEqual(
    analystClaims.map((response) => response.status).sort(),
    [201, 409],
  );
  const analystResponse = analystClaims.find(
    (response) => response.status === 201,
  );
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];
  const claimedCase = await getCase();
  assert.ok(claimedCase.detectiveSessionHash);
  assert.ok(claimedCase.analystSessionHash);

  const [detectiveState, analystState] = await Promise.all([
    request("/api/investigation/state", {
      headers: { cookie: detectiveCookie },
    }),
    request("/api/investigation/state", { headers: { cookie: analystCookie } }),
  ]);
  assert.equal((await detectiveState.json()).state.role, "detective");
  assert.equal((await analystState.json()).state.role, "analyst");
  const publicState = await request("/api/investigation/state", {
    headers: { cookie: detectiveCookie },
  });
  assert.equal(
    Object.hasOwn((await publicState.json()).state, "finalResult"),
    false,
  );
  assert.equal((await joinAnalyst(joined.analystInvite)).status, 401);
});

test("evidence 2 and 3 can be collected by either role while evidence 1 is detective-only", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];

  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, analystCookie))
      .status,
    403,
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, detectiveCookie))
      .status,
    201,
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev4" }, analystCookie))
      .status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/investigation/decrypt",
        { token: "HELIX" },
        detectiveCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev2" }, detectiveCookie))
      .status,
    201,
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev2" }, analystCookie))
      .status,
    409,
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev3" }, analystCookie))
      .status,
    201,
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev3" }, detectiveCookie))
      .status,
    409,
  );
});

test("evidence, decryption, accusation, and cross-role approvals are atomic", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];

  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, analystCookie))
      .status,
    403,
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, detectiveCookie))
      .status,
    201,
  );
  const duplicateEvidence = await Promise.all([
    post("/api/investigation/evidence", { key: "ev2" }, detectiveCookie),
    post("/api/investigation/evidence", { key: "ev2" }, analystCookie),
  ]);
  assert.deepEqual(
    duplicateEvidence.map((response) => response.status).sort(),
    [201, 409],
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev3" }, analystCookie))
      .status,
    201,
  );

  assert.equal(
    (
      await post(
        "/api/investigation/decrypt",
        { token: "NOT-HELIX" },
        analystCookie,
      )
    ).status,
    400,
  );
  const afterFailedDecryption = await getCase();
  assert.equal(afterFailedDecryption.decrypted, false);
  assert.equal(afterFailedDecryption.decryptedAt, null);
  assert.equal(
    afterFailedDecryption.clues.some((clue) => clue.key === "ev4"),
    false,
  );

  const decryption = await Promise.all([
    post("/api/investigation/decrypt", { token: "HELIX" }, analystCookie),
    post("/api/investigation/decrypt", { token: "HELIX" }, analystCookie),
  ]);
  assert.deepEqual(
    decryption.map((response) => response.status).sort(),
    [200, 200],
  );

  const accusation = await Promise.all([
    post(
      "/api/investigation/accusation",
      {
        suspect: "Mara Chen",
        evidenceKey: "ev2",
        reasoning:
          "The access record connects the suspect to the archive breach.",
      },
      detectiveCookie,
    ),
    post(
      "/api/investigation/accusation",
      {
        suspect: "Idris Khan",
        evidenceKey: "ev2",
        reasoning:
          "A competing accusation must not replace the original submission.",
      },
      detectiveCookie,
    ),
  ]);
  assert.deepEqual(
    accusation.map((response) => response.status).sort(),
    [201, 409],
  );
  const winningAccusation = accusation[0].status === 201
    ? { suspect: "Mara Chen", reasoning: "The access record connects the suspect to the archive breach." }
    : { suspect: "Idris Khan", reasoning: "A competing accusation must not replace the original submission." };
  const submitterApproval = await post(
    "/api/investigation/accusation/approve",
    {},
    detectiveCookie,
  );
  assert.equal(submitterApproval.status, 409);

  const approvals = await Promise.all([
    post("/api/investigation/accusation/approve", {}, analystCookie),
    post("/api/investigation/accusation/approve", {}, analystCookie),
  ]);
  assert.deepEqual(
    approvals.map((response) => response.status).sort(),
    [200, 409],
  );
  const agreed = await approvals
    .find((response) => response.status === 200)
    .json();
  assert.equal(agreed.state.accusation.agreed, true);
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev3" }, detectiveCookie))
      .status,
    409,
  );

  await endRound(3, "investigation-branch-test");
  const savedCase = await getCase();
  assert.deepEqual(
    savedCase.finalResult.evidence.map((clue) => clue.key).sort(),
    ["ev1", "ev2", "ev3", "ev4"],
  );
  assert.equal(
    savedCase.finalResult.evidence.find((clue) => clue.key === "ev1").addedBy,
    "detective",
  );
  assert.equal(
    savedCase.finalResult.evidence.find((clue) => clue.key === "ev3").addedBy,
    "analyst",
  );
  assert.ok(
    savedCase.finalResult.evidence.every(
      (clue) => clue.addedAt instanceof Date,
    ),
  );
  assert.equal(savedCase.finalResult.decryption.succeeded, true);
  assert.ok(savedCase.finalResult.decryption.succeededAt instanceof Date);
  assert.deepEqual(savedCase.finalResult.accusation, {
    submitted: true,
    suspect: winningAccusation.suspect,
    evidenceKey: "ev2",
    reasoning: winningAccusation.reasoning,
    initiatedBy: "detective",
    initiatedAt: savedCase.finalResult.accusation.initiatedAt,
    approvals: { detective: true, analyst: true },
    agreed: true,
  });
  assert.ok(savedCase.finalResult.accusation.initiatedAt instanceof Date);
  assert.equal(
    savedCase.finalResult.roundEndedAt.getTime(),
    (await RoundState.findOne({ round: 3 })).endedAt.getTime(),
  );

  const adminCookie = await adminLogin();
  const adminResults = await request("/api/admin/investigation/final-results", {
    headers: { cookie: adminCookie },
  });
  assert.equal(adminResults.status, 200);
  const result = (await adminResults.json()).find(
    (item) => item.teamId === teamId,
  );
  assert.ok(result);
  assert.equal(result.decryption.succeeded, true);
  assert.ok(result.decryption.succeededAt);
  assert.equal(result.accusation.agreed, true);
  assert.deepEqual(result.accusation.approvals, {
    detective: true,
    analyst: true,
  });
  assert.ok(result.roundEndedAt);
});

test("analyst may initiate an accusation citing collected evidence and detective approval completes agreement", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];

  assert.equal(
    (
      await post(
        "/api/investigation/accusation",
        {
          suspect: "Sofia Laurent",
          evidenceKey: "ev2",
          reasoning:
            "The evidence record links the suspect to the secured archive.",
        },
        analystCookie,
      )
    ).status,
    409,
  );
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev2" }, analystCookie))
      .status,
    201,
  );
  const submitted = await post(
    "/api/investigation/accusation",
    {
      suspect: "Sofia Laurent",
      evidenceKey: "ev2",
      reasoning:
        "The evidence record links the suspect to the secured archive.",
    },
    analystCookie,
  );
  assert.equal(submitted.status, 201);
  assert.deepEqual((await submitted.json()).state.accusation.approvals, [
    "analyst",
  ]);
  assert.equal(
    (await post("/api/investigation/accusation/approve", {}, detectiveCookie))
      .status,
    200,
  );
  assert.equal(
    (await post("/api/investigation/accusation/approve", {}, detectiveCookie))
      .status,
    409,
  );
  const state = await request("/api/investigation/state", {
    headers: { cookie: detectiveCookie },
  });
  assert.equal((await state.json()).state.accusation.agreed, true);
  await endRound(3, "investigation-branch-test");
  const finalResult = (await getCase()).finalResult;
  assert.equal(finalResult.accusation.submitted, true);
  assert.equal(finalResult.accusation.initiatedBy, "analyst");
  assert.deepEqual(finalResult.accusation.approvals, {
    detective: true,
    analyst: true,
  });
  assert.equal(finalResult.accusation.agreed, true);
});

test("final result records a pending accusation when the round ends before dual approval", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];

  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev2" }, analystCookie))
      .status,
    201,
  );
  assert.equal(
    (
      await post(
        "/api/investigation/accusation",
        {
          suspect: "Idris Khan",
          evidenceKey: "ev2",
          reasoning:
            "The recovered record places the suspect near the restricted archive.",
        },
        analystCookie,
      )
    ).status,
    201,
  );
  await endRound(3, "investigation-branch-test");
  const finalAccusation = (await getCase()).finalResult.accusation;
  assert.equal(finalAccusation.submitted, false);
  assert.equal(finalAccusation.initiatedBy, "analyst");
  assert.deepEqual(finalAccusation.approvals, {
    detective: false,
    analyst: true,
  });
  assert.equal(finalAccusation.agreed, false);
});

test("admin final result persists for rounds without decryption or accusation and cannot be overwritten", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, detectiveCookie))
      .status,
    201,
  );

  const unauthorized = await request("/api/admin/investigation/final-results");
  assert.equal(unauthorized.status, 403);
  const teamAccess = await request("/api/admin/investigation/final-results", {
    headers: { cookie: detectiveCookie },
  });
  assert.equal(teamAccess.status, 403);
  const analystAccess = await request(
    "/api/admin/investigation/final-results",
    {
      headers: { cookie: analystCookie },
    },
  );
  assert.equal(analystAccess.status, 403);
  const adminCookie = await adminLogin();

  const ended = await request("/api/admin/rounds/3/end", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: "{}",
  });
  assert.equal(ended.status, 200);

  const resultResponse = await request(
    "/api/admin/investigation/final-results",
    {
      headers: { cookie: adminCookie },
    },
  );
  assert.equal(resultResponse.status, 200);
  const results = await resultResponse.json();
  const result = results.find((item) => item.teamId === teamId);
  assert.ok(result);
  assert.equal(result.teamId, teamId);
  assert.deepEqual(
    result.evidence.map((clue) => clue.key),
    ["ev1"],
  );
  assert.equal(result.evidence[0].addedBy, "detective");
  assert.ok(result.evidence[0].addedAt);
  assert.deepEqual(result.decryption, { succeeded: false, succeededAt: null });
  assert.equal(result.accusation, null);
  assert.ok(result.roundEndedAt);

  const publicState = await request("/api/investigation/state", {
    headers: { cookie: detectiveCookie },
  });
  const publicPayload = await publicState.json();
  assert.equal(Object.hasOwn(publicPayload.state, "finalResult"), false);
  assert.equal(Object.hasOwn(publicPayload, "finalResult"), false);
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev2" }, detectiveCookie))
      .status,
    409,
  );

  const beforeRetry = await getCase();
  const duplicateEnd = await request("/api/admin/rounds/3/end", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: adminCookie },
    body: "{}",
  });
  assert.equal(duplicateEnd.status, 409);
  await initializeRoundStates();
  const afterRetry = await getCase();
  assert.deepEqual(afterRetry.finalResult, beforeRetry.finalResult);
  assert.equal(
    afterRetry.finalResult.roundEndedAt.getTime(),
    new Date(result.roundEndedAt).getTime(),
  );
  await startRound(3, 300, "investigation-branch-test");
  const afterRestart = await getCase();
  assert.deepEqual(afterRestart.finalResult, beforeRetry.finalResult);
  assert.ok(joined.analystInvite);
});

test("manual round end records an empty evidence ledger and no decryption or accusation", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  await joinDetective(detectiveCookie);

  await endRound(3, "investigation-branch-test");
  const savedCase = await getCase();
  assert.deepEqual(savedCase.finalResult.evidence, []);
  assert.deepEqual(savedCase.finalResult.decryption, {
    succeeded: false,
    succeededAt: null,
  });
  assert.equal(savedCase.finalResult.accusation, null);
  assert.equal(
    savedCase.finalResult.roundEndedAt.getTime(),
    (await RoundState.findOne({ round: 3 })).endedAt.getTime(),
  );
});

test("Round 3 cannot be paused after its persisted deadline before monitor closure", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  await joinDetective(detectiveCookie);
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, detectiveCookie))
      .status,
    201,
  );
  const expiredDeadline = new Date(Date.now() - 1000);
  await RoundState.updateOne(
    { round: 3 },
    { $set: { deadline: expiredDeadline } },
  );

  await assert.rejects(pauseRound(3, "investigation-branch-test"), {
    code: "ROUND_STATE_CHANGED",
  });
  assert.equal(
    (await RoundState.findOne({ round: 3 }).lean()).status,
    "running",
  );

  await initializeRoundStates();
  const endedRound = await RoundState.findOne({ round: 3 }).lean();
  const savedCase = await getCase();
  assert.equal(endedRound.status, "ended");
  assert.equal(
    savedCase.finalResult.roundEndedAt.getTime(),
    expiredDeadline.getTime(),
  );
  assert.deepEqual(
    savedCase.finalResult.evidence.map((clue) => clue.key),
    ["ev1"],
  );
});

test("startup recovers a missing final snapshot after the round end was persisted", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  await joinDetective(detectiveCookie);
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, detectiveCookie))
      .status,
    201,
  );

  const endedAt = new Date(Date.now() - 1000);
  await RoundState.updateOne(
    { round: 3 },
    { $set: { status: "ended", endedAt } },
  );
  await initializeRoundStates();

  const savedCase = await getCase();
  assert.deepEqual(
    savedCase.finalResult.evidence.map((clue) => clue.key),
    ["ev1"],
  );
  assert.equal(savedCase.finalResult.evidence[0].addedBy, "detective");
  assert.equal(savedCase.finalResult.roundEndedAt.getTime(), endedAt.getTime());
});

test("startup migrates a legacy case into an ended round with its final snapshot", async () => {
  const endedAt = new Date(Date.now() - 1000);
  await RoundState.create({
    round: 3,
    attemptNo: 1,
    status: "ended",
    endedAt,
  });
  await InvestigationCase.create({
    teamId,
    round: 3,
    attemptNo: 1,
    detectiveJoinedAt: new Date(endedAt.getTime() - 10_000),
    clues: [{ key: "ev1", addedBy: "detective", addedAt: endedAt }],
  });

  await initializeRoundStates();

  const migratedCase = await getCase();
  assert.ok(migratedCase);
  assert.deepEqual(
    migratedCase.finalResult.evidence.map((clue) => clue.key),
    ["ev1"],
  );
  assert.equal(
    migratedCase.finalResult.roundEndedAt.getTime(),
    endedAt.getTime(),
  );
  assert.equal(await InvestigationCase.countDocuments({ teamId }), 1);
});

test("expired rounds remain readable but reject mutations, and old attempt sessions are stale", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, detectiveCookie))
      .status,
    201,
  );
  await RoundState.updateOne(
    { round: 3 },
    { $set: { deadline: new Date(Date.now() - 1000) } },
  );
  await initializeRoundStates();

  const lockedState = await request("/api/investigation/state", {
    headers: { cookie: detectiveCookie },
  });
  assert.equal(lockedState.status, 200);
  const lockedPayload = await lockedState.json();
  assert.equal(lockedPayload.roundStatus, "ended");
  assert.ok(lockedPayload.deadline);
  assert.equal(
    (await post("/api/investigation/evidence", { key: "ev1" }, detectiveCookie))
      .status,
    409,
  );
  const endedRound = await RoundState.findOne({ round: 3 }).lean();
  const savedCase = await getCase();
  assert.equal(endedRound.status, "ended");
  assert.equal(
    savedCase.finalResult.roundEndedAt.getTime(),
    endedRound.deadline.getTime(),
  );
  assert.deepEqual(
    savedCase.finalResult.evidence.map((clue) => clue.key),
    ["ev1"],
  );
  assert.equal(savedCase.finalResult.evidence[0].addedBy, "detective");

  await RoundState.updateOne({ round: 3 }, { $set: { status: "ended" } });
  await initializeRoundStates();
  await startRound(3, 300, "investigation-branch-test");
  const stale = await request("/api/investigation/state", {
    headers: { cookie: detectiveCookie },
  });
  assert.equal(stale.status, 403);
  assert.ok(joined.analystInvite);
});

test("a delayed evidence write is rejected after expiry before monitor closure", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  await joinDetective(detectiveCookie);
  const barrier = holdNextAggregateAdmission();
  try {
    const delayedWrite = post(
      "/api/investigation/evidence",
      { key: "ev2" },
      detectiveCookie,
    );
    await barrier.entered;
    const expiredDeadline = new Date(Date.now() - 1000);
    await RoundState.updateOne(
      { round: 3 },
      { $set: { deadline: expiredDeadline } },
    );
    barrier.release();

    assert.equal((await delayedWrite).status, 409);
    assert.equal(
      (await RoundState.findOne({ round: 3 }).lean()).status,
      "running",
    );
    assert.deepEqual((await getCase()).clues, []);
    assert.equal((await getCase()).finalResult, undefined);

    await initializeRoundStates();
    const endedRound = await RoundState.findOne({ round: 3 }).lean();
    const savedCase = await getCase();
    assert.equal(endedRound.status, "ended");
    assert.equal(
      savedCase.finalResult.roundEndedAt.getTime(),
      expiredDeadline.getTime(),
    );
    assert.deepEqual(savedCase.finalResult.evidence, []);
  } finally {
    barrier.release();
    barrier.restore();
  }
});

test("a mutation written before finalization is included in its immutable snapshot", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  await joinDetective(detectiveCookie);
  const barrier = holdNextAggregateAdmission({ afterWrite: true });
  try {
    const admittedWrite = post(
      "/api/investigation/evidence",
      { key: "ev2" },
      detectiveCookie,
    );
    await barrier.entered;
    assert.deepEqual(
      (await getCase()).clues.map((clue) => clue.key),
      ["ev2"],
    );

    await endRound(3, "investigation-branch-test");
    const resultAtClose = (await getCase()).finalResult;
    assert.deepEqual(
      resultAtClose.evidence.map((clue) => clue.key),
      ["ev2"],
    );

    barrier.release();
    assert.equal((await admittedWrite).status, 201);
    assert.deepEqual((await getCase()).finalResult, resultAtClose);
    assert.equal(
      (
        await post(
          "/api/investigation/evidence",
          { key: "ev3" },
          detectiveCookie,
        )
      ).status,
      409,
    );
    assert.deepEqual((await getCase()).finalResult, resultAtClose);
  } finally {
    barrier.release();
    barrier.restore();
  }
});

test("a mutation reaching the database after finalization cannot change the snapshot", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  await joinDetective(detectiveCookie);
  const barrier = holdNextAggregateAdmission();
  try {
    const delayedWrite = post(
      "/api/investigation/evidence",
      { key: "ev2" },
      detectiveCookie,
    );
    await barrier.entered;
    await endRound(3, "investigation-branch-test");
    const resultAtClose = (await getCase()).finalResult;
    assert.deepEqual(resultAtClose.evidence, []);

    barrier.release();
    assert.equal((await delayedWrite).status, 409);
    assert.deepEqual((await getCase()).finalResult, resultAtClose);
  } finally {
    barrier.release();
    barrier.restore();
  }
});

test("detective role claim delayed past expiry is not admitted", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const barrier = holdNextAggregateAdmission();
  try {
    const delayedJoin = joinDetective(detectiveCookie);
    await barrier.entered;
    await RoundState.updateOne(
      { round: 3 },
      { $set: { deadline: new Date(Date.now() - 1000) } },
    );
    barrier.release();
    assert.equal((await delayedJoin).status, 409);
    assert.deepEqual(
      (await RoundState.findOne({ round: 3 }).lean()).investigations,
      [],
    );
  } finally {
    barrier.release();
    barrier.restore();
  }
});

test("analyst session saved before a delayed role claim is not authorized after expiry", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const barrier = holdNextAggregateAdmission();
  try {
    const delayedJoin = joinAnalyst(joined.analystInvite);
    await barrier.entered;
    await RoundState.updateOne(
      { round: 3 },
      { $set: { deadline: new Date(Date.now() - 1000) } },
    );
    barrier.release();
    const response = await delayedJoin;
    assert.equal(response.status, 409);
    const savedCase = await getCase();
    assert.equal(savedCase.analystJoinedAt, null);
    assert.equal(savedCase.analystSessionHash, null);
    const analystCookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    if (analystCookie) {
      assert.equal(
        (
          await request("/api/investigation/state", {
            headers: { cookie: analystCookie },
          })
        ).status,
        403,
      );
    }
  } finally {
    barrier.release();
    barrier.restore();
  }
});

test("expired analyst invites cannot be redeemed", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  await RoundState.updateOne(
    { round: 3, "investigations.teamId": teamId },
    {
      $set: {
        "investigations.$.inviteExpiresAt": new Date(Date.now() - 1000),
      },
    },
  );
  assert.equal((await joinAnalyst(joined.analystInvite)).status, 401);
});

test("same-screen mode: one session holds both seats and role permissions are strictly enforced", async () => {
  await startRound(3, 300, "investigation-branch-test");
  const teamCookie = await login();

  // Same-screen join with single session
  const joinRes = await post("/api/investigation/join/same-screen", {}, teamCookie);
  assert.equal(joinRes.status, 200);
  const joinData = await joinRes.json();
  assert.equal(joinData.ok, true);
  assert.equal(joinData.detectiveState.role, "detective");
  assert.equal(joinData.analystState.role, "analyst");

  // Detective fetches state with x-acting-role: detective
  const detStateRes = await request("/api/investigation/state", {
    headers: { cookie: teamCookie, "x-acting-role": "detective" },
  });
  assert.equal(detStateRes.status, 200);
  const detState = await detStateRes.json();
  assert.equal(detState.state.role, "detective");

  // Analyst fetches state with x-acting-role: analyst on SAME cookie
  const anaStateRes = await request("/api/investigation/state", {
    headers: { cookie: teamCookie, "x-acting-role": "analyst" },
  });
  assert.equal(anaStateRes.status, 200);
  const anaState = await anaStateRes.json();
  assert.equal(anaState.state.role, "analyst");

  // ev1 is detective-only: analyst attempting ev1 gets 403
  const anaEv1 = await request("/api/investigation/evidence", {
    method: "POST",
    headers: { cookie: teamCookie, "Content-Type": "application/json", "x-acting-role": "analyst" },
    body: JSON.stringify({ key: "ev1" }),
  });
  assert.equal(anaEv1.status, 403);

  // Detective successfully submits ev1
  const detEv1 = await request("/api/investigation/evidence", {
    method: "POST",
    headers: { cookie: teamCookie, "Content-Type": "application/json", "x-acting-role": "detective" },
    body: JSON.stringify({ key: "ev1" }),
  });
  assert.equal(detEv1.status, 201);

  // Detective cannot decrypt (only analyst decrypts)
  const detDecrypt = await request("/api/investigation/decrypt", {
    method: "POST",
    headers: { cookie: teamCookie, "Content-Type": "application/json", "x-acting-role": "detective" },
    body: JSON.stringify({ token: "HELIX" }),
  });
  assert.equal(detDecrypt.status, 403);

  // Analyst successfully decrypts
  const anaDecrypt = await request("/api/investigation/decrypt", {
    method: "POST",
    headers: { cookie: teamCookie, "Content-Type": "application/json", "x-acting-role": "analyst" },
    body: JSON.stringify({ token: "HELIX" }),
  });
  assert.equal(anaDecrypt.status, 200);
  const decryptData = await anaDecrypt.json();
  assert.equal(decryptData.state.decrypted, true);

  // Detective submits accusation citing ev1
  const detAccuse = await request("/api/investigation/accusation", {
    method: "POST",
    headers: { cookie: teamCookie, "Content-Type": "application/json", "x-acting-role": "detective" },
    body: JSON.stringify({
      suspect: "Mara Chen",
      evidenceKey: "ev1",
      reasoning: "Comprehensive forensic audit reveals physical access log anomaly.",
    }),
  });
  assert.equal(detAccuse.status, 201);

  // Submitter (detective) cannot approve their own accusation
  const detSelfApprove = await request("/api/investigation/accusation/approve", {
    method: "POST",
    headers: { cookie: teamCookie, "Content-Type": "application/json", "x-acting-role": "detective" },
    body: JSON.stringify({}),
  });
  assert.equal(detSelfApprove.status, 409);

  // Partner (analyst) approves the accusation
  const anaApprove = await request("/api/investigation/accusation/approve", {
    method: "POST",
    headers: { cookie: teamCookie, "Content-Type": "application/json", "x-acting-role": "analyst" },
    body: JSON.stringify({}),
  });
  assert.equal(anaApprove.status, 200);
  const finalData = await anaApprove.json();
  assert.equal(finalData.state.accusation.agreed, true);
});

