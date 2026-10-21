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
import { TeamProgression } from "../src/models/TeamProgression.js";
import { ScoreEntry } from "../src/models/ScoreEntry.js";
import {
  endRound,
  initializeRoundStates,
  pauseRound,
  ROUND3_DURATION_SEC,
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

async function joinAnalyst(invite, cookie) {
  return post("/api/investigation/join/analyst", { invite }, cookie);
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
  await TeamProgression.create({
    teamId,
    initialRound: 3,
    maxEligibleRound: 3,
    waivedRounds: [1, 2],
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
  await ScoreEntry.deleteMany({ teamId, round: 3, game: "investigation" });
  await RoundState.deleteMany({ round: 3 });
  await initializeRoundStates();
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await InvestigationCase.deleteMany({ teamId });
  await ScoreEntry.deleteMany({ teamId, round: 3, game: "investigation" });
  await Team.deleteMany({ teamId });
  await TeamProgression.deleteMany({ teamId });
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
      "access-control-request-headers": "content-type, x-investigation-role",
    },
  });
  assert.equal(prototypePreflight.status, 204);
  assert.equal(
    prototypePreflight.headers.get("access-control-allow-origin"),
    "http://localhost:5177",
  );
  assert.match(
    prototypePreflight.headers.get("access-control-allow-headers") || "",
    /x-investigation-role/i,
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
    joinAnalyst(` ${joined.analystInvite} `, detectiveCookie),
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
  assert.match(analystCookie, /^cc_analyst\.sid=/);
  assert.match(detectiveCookie, /^cc_team\.sid=/);
  const claimedCase = await getCase();
  assert.ok(claimedCase.detectiveSessionHash);
  assert.ok(claimedCase.analystSessionHash);

  const [detectiveState, analystState] = await Promise.all([
    request("/api/investigation/state", {
      headers: {
        cookie: `${detectiveCookie}; ${analystCookie}`,
        "x-investigation-role": "detective",
      },
    }),
    request("/api/investigation/state", {
      headers: {
        cookie: `${detectiveCookie}; ${analystCookie}`,
        "x-investigation-role": "analyst",
      },
    }),
  ]);
  const detectivePayload = await detectiveState.json();
  const analystPayload = await analystState.json();
  assert.equal(detectivePayload.state.role, "detective");
  assert.equal(analystPayload.state.role, "analyst");
  assert.equal(detectivePayload.deadline, analystPayload.deadline);
  assert.ok(Date.parse(detectivePayload.serverNow));
  assert.ok(Date.parse(analystPayload.serverNow));
  const publicState = await request("/api/investigation/state", {
    headers: { cookie: detectiveCookie },
  });
  assert.equal(
    Object.hasOwn((await publicState.json()).state, "finalResult"),
    false,
  );
  assert.equal((await joinAnalyst(joined.analystInvite)).status, 401);
});

test("Round 3 detective admission requires eligible team progression", async () => {
  await startRound(3, 300, "investigation-progression-test");
  await TeamProgression.updateOne(
    { teamId },
    { $set: { initialRound: 1, maxEligibleRound: 1, waivedRounds: [] } },
  );
  try {
    const response = await joinDetective(await login());
    assert.equal(response.status, 403);
    assert.equal(
      (await response.json()).code,
      "PROGRESSION_PREREQUISITE_NOT_MET",
    );
    assert.equal(await getCase(), null);
  } finally {
    await TeamProgression.updateOne(
      { teamId },
      { $set: { initialRound: 3, maxEligibleRound: 3, waivedRounds: [1, 2] } },
    );
  }
});

test("Round 3 starts with a fixed 45-minute duration", async () => {
  const started = await startRound(3, 3600, "investigation-duration-test");
  assert.equal(started.durationSec, ROUND3_DURATION_SEC);
  assert.equal(started.durationSec, 2700);
  assert.equal(
    started.deadline.getTime() - started.startedAt.getTime(),
    2700 * 1000,
  );
});

test("paused participant state exposes the pause time and server deadline", async () => {
  const started = await startRound(3, 300, "investigation-pause-test");
  const detectiveCookie = await login();
  assert.equal((await joinDetective(detectiveCookie)).status, 201);
  const paused = await pauseRound(3, "investigation-pause-test");
  const response = await request("/api/investigation/state", {
    headers: { cookie: detectiveCookie },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.roundStatus, "paused");
  assert.equal(payload.deadline, paused.deadline.toISOString());
  assert.equal(payload.pausedAt, paused.pausedAt.toISOString());
  assert.equal(payload.deadline, started.deadline.toISOString());
});

test("the detective can renew an expired invitation without replacing its session", async () => {
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

  const renewed = await post(
    "/api/investigation/invitation/renew",
    {},
    detectiveCookie,
  );
  assert.equal(renewed.status, 200);
  assert.equal(renewed.headers.get("set-cookie"), null);
  const renewal = await renewed.json();
  assert.notEqual(renewal.analystInvite, joined.analystInvite);
  assert.ok(new Date(renewal.inviteExpiresAt).getTime() > Date.now());
  assert.equal((await joinAnalyst(joined.analystInvite)).status, 401);

  const analyst = await joinAnalyst(renewal.analystInvite);
  assert.equal(analyst.status, 201);
  assert.equal(
    (
      await request("/api/investigation/state", {
        headers: { cookie: detectiveCookie },
      })
    ).status,
    200,
  );
});

test("Case HELIX exposes role-appropriate branches and protects locked evidence", async () => {
  await startRound(3, 300, "case-helix-branch-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];

  const detectivePayload = await (
    await request("/api/investigation/case", {
      headers: { cookie: detectiveCookie },
    })
  ).json();
  assert.equal(detectivePayload.case.suspects.length, 10);
  assert.equal(detectivePayload.case.evidence.length, 28);
  assert.equal(
    detectivePayload.case.evidence.find(({ id }) => id === "EV01").available,
    true,
  );
  assert.equal(
    detectivePayload.case.evidence.find(({ id }) => id === "EV05").available,
    false,
  );
  assert.equal(
    detectivePayload.case.evidence.find(({ id }) => id === "EV26").detail,
    null,
  );
  assert.equal(
    JSON.stringify(detectivePayload).includes("privateSecret"),
    false,
  );

  assert.equal(
    (await post("/api/investigation/case/evidence/EV01", {}, analystCookie))
      .status,
    403,
  );
  assert.equal(
    (await post("/api/investigation/case/evidence/EV07", {}, analystCookie))
      .status,
    409,
  );
  assert.equal(
    (await post("/api/investigation/case/evidence/EV01", {}, detectiveCookie))
      .status,
    201,
  );
  const analystPayload = await (
    await request("/api/investigation/case", {
      headers: { cookie: analystCookie },
    })
  ).json();
  assert.equal(analystPayload.state.discoveredEvidence.includes("EV01"), true);
});

test("clock puzzle validates exact answers, role, prerequisites, and shared persistence", async () => {
  await startRound(3, 300, "case-helix-puzzle-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];

  assert.equal(
    (
      await post(
        "/api/investigation/case/puzzles/clocks",
        { answer: {} },
        detectiveCookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (await post("/api/investigation/case/evidence/EV05", {}, analystCookie))
      .status,
    201,
  );
  assert.equal(
    (await post("/api/investigation/case/evidence/EV06", {}, analystCookie))
      .status,
    201,
  );
  assert.equal(
    (
      await post(
        "/api/investigation/case/puzzles/clocks",
        { answer: {} },
        analystCookie,
      )
    ).status,
    422,
  );
  assert.equal(
    (await post("/api/investigation/case/evidence/EV07", {}, analystCookie))
      .status,
    201,
  );
  const incorrect = await post(
    "/api/investigation/case/puzzles/clocks",
    {
      answer: {
        offsetMinutes: 1,
        eventOrder: [
          "maintenance-prepared",
          "credential-event",
          "service-relay",
          "exception-active",
          "token-accepted-export",
          "audit-view-changed",
        ],
      },
    },
    analystCookie,
  );
  assert.equal(incorrect.status, 422);
  const correct = await post(
    "/api/investigation/case/puzzles/clocks",
    {
      answer: {
        offsetMinutes: 2,
        eventOrder: [
          "maintenance-prepared",
          "credential-event",
          "service-relay",
          "exception-active",
          "token-accepted-export",
          "audit-view-changed",
        ],
      },
    },
    analystCookie,
  );
  assert.equal(correct.status, 200);
  assert.equal(
    (await correct.json()).state.solvedPuzzles.includes("clocks"),
    true,
  );
  const detectiveState = await request("/api/investigation/state", {
    headers: { cookie: detectiveCookie },
  });
  assert.equal(
    (await detectiveState.json()).state.solvedPuzzles.includes("clocks"),
    true,
  );
});

test("interview follow-ups require evidence and persist their transcript for both players", async () => {
  await startRound(3, 300, "case-helix-interview-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];
  const body = { suspectId: "mara", topicId: "badge", evidenceId: "EV01" };

  assert.equal(
    (await post("/api/investigation/case/interviews", body, analystCookie))
      .status,
    403,
  );
  assert.equal(
    (await post("/api/investigation/case/interviews", body, detectiveCookie))
      .status,
    409,
  );
  assert.equal(
    (await post("/api/investigation/case/evidence/EV01", {}, detectiveCookie))
      .status,
    201,
  );
  const response = await post(
    "/api/investigation/case/interviews",
    body,
    detectiveCookie,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.match(payload.answer, /badge number.*who was holding it/i);
  assert.equal(payload.unlockedEvidence, "EV10");
  const shared = await (
    await request("/api/investigation/state", {
      headers: { cookie: analystCookie },
    })
  ).json();
  assert.equal(shared.state.discoveredEvidence.includes("EV10"), true);
  assert.equal(
    shared.state.gameState.transcripts["mara:badge"],
    payload.answer,
  );
});

test("legacy four-clue accusation cannot bypass the structured report", async () => {
  await startRound(3, 300, "case-helix-retirement-test");
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];
  const legacyReport = {
    suspect: "Idris Khan",
    evidenceKey: "ev1",
    reasoning: "Legacy accusation must not finalize this case.",
  };
  assert.equal(
    (await post("/api/investigation/accusation", legacyReport, detectiveCookie))
      .status,
    410,
  );
  assert.equal(
    (await post("/api/investigation/accusation/approve", {}, analystCookie))
      .status,
    410,
  );
  assert.equal((await getCase()).accusation, null);
});

async function prepareReportReadyCase(roundName) {
  await startRound(3, 1800, roundName);
  const detectiveCookie = await login();
  const joined = await (await joinDetective(detectiveCookie)).json();
  const analystResponse = await joinAnalyst(joined.analystInvite);
  const analystCookie = analystResponse.headers
    .get("set-cookie")
    .split(";", 1)[0];
  const getPublicCase = async (cookie) =>
    await (
      await request("/api/investigation/case", { headers: { cookie } })
    ).json();
  const reportPathEvidence = new Set([
    "EV01",
    "EV03",
    "EV05",
    "EV06",
    "EV07",
    "EV08",
    "EV09",
    "EV11",
    "EV14",
    "EV17",
    "EV18",
    "EV19",
    "EV20",
    "EV22",
    "EV24",
    "EV26",
    "EV27",
    "EV28",
  ]);

  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (const [cookie, role] of [
      [detectiveCookie, "detective"],
      [analystCookie, "analyst"],
    ]) {
      const current = await getPublicCase(cookie);
      for (const item of current.case.evidence) {
        if (
          !reportPathEvidence.has(item.id) ||
          !item.available ||
          current.state.discoveredEvidence.includes(item.id)
        ) {
          continue;
        }
        const response = await post(
          `/api/investigation/case/evidence/${item.id}`,
          {},
          cookie,
        );
        assert.equal(
          response.status,
          201,
          `${role} should discover ${item.id}`,
        );
        changed = true;
      }
    }

    const detectiveCase = await getPublicCase(detectiveCookie);
    const maraDeparture = detectiveCase.case.suspects
      .find(({ id }) => id === "mara")
      .topics.find(({ id }) => id === "departure");
    if (!detectiveCase.state.interviewFindings.includes("mara:departure")) {
      const response = await post(
        "/api/investigation/case/interviews",
        { suspectId: "mara", topicId: maraDeparture.id },
        detectiveCookie,
      );
      assert.equal(response.status, 200, "one optional suspect interview");
      changed = true;
    }
    if (!changed) break;
  }

  const fullCase = await getPublicCase(detectiveCookie);
  const discovered = new Set(fullCase.state.discoveredEvidence);
  assert.equal(discovered.size, reportPathEvidence.size);
  assert.ok(fullCase.state.resolvedHypotheses.length < 6);
  assert.equal(fullCase.state.interviewFindings.length, 1);

  const eventOrder = [
    "maintenance-prepared",
    "credential-event",
    "service-relay",
    "exception-active",
    "token-accepted-export",
    "audit-view-changed",
  ];
  const solve = async (id, answer, cookie) => {
    const response = await post(
      `/api/investigation/case/puzzles/${id}`,
      { answer },
      cookie,
    );
    assert.equal(response.status, 200, `${id} should solve`);
  };
  await solve("clocks", { offsetMinutes: 2, eventOrder }, analystCookie);
  await solve(
    "audit",
    {
      missingField: "maintenanceContext",
      sourceRecord: "authorization-source-ledger",
      noteCreatedAt: "22:06",
      noteIngestedAt: "08:40",
      viewModifiedAt: "02:15",
    },
    analystCookie,
  );
  return { detectiveCookie, analystCookie, getCase };
}

function validCaseReport() {
  return {
    suspectId: "idris",
    method: "temporary-maintenance-exception",
    motive: "conceal-audit-exposure",
    eventOrder: [
      "maintenance-prepared",
      "credential-event",
      "service-relay",
      "exception-active",
      "token-accepted-export",
      "audit-view-changed",
    ],
    evidenceIds: [
      "EV01",
      "EV03",
      "EV07",
      "EV11",
      "EV14",
      "EV18",
      "EV17",
      "EV24",
      "EV26",
      "EV27",
      "EV28",
    ],
    auditExplanation: "later-summary-omitted-maintenance-context",
    rejectedTheories: ["database", "contractor"],
    alternativeReasoning: {
      database:
        "EV03 records a search of system information, and EV11 confirms it returned no research files; neither explains the separate transfer.",
      contractor:
        "EV14 closes Gabriel's approved repair at 9:14 p.m.; EV18 records his device return, while later access is separately documented.",
    },
    reasoning:
      "The source event, signed exception, export receipt, and audit view diff support one sequence. Independent records also show that the database query and contractor work do not account for the authorization and later view change.",
  };
}

test("short cooperative investigation submits a report without hypothesis assessments and completes partner approval", async () => {
  const { detectiveCookie, analystCookie, getCase } =
    await prepareReportReadyCase("case-helix-report-without-assessments");
  const caseReport = validCaseReport();
  const readyState = await getCase();
  assert.equal(readyState.gameState.hypothesisAssessments, undefined);

  const guess = await post(
    "/api/investigation/case/report",
    { ...caseReport, suspectId: "mara" },
    detectiveCookie,
  );
  assert.equal(guess.status, 422);
  assert.equal((await guess.json()).error.includes("Idris"), false);
  assert.equal((await getCase()).gameState.report, undefined);

  for (const invalidReport of [
    {
      ...caseReport,
      evidenceIds: caseReport.evidenceIds.filter((id) => id !== "EV28"),
    },
    { ...caseReport, evidenceIds: [...caseReport.evidenceIds, "EV02"] },
    { ...caseReport, evidenceIds: [...caseReport.evidenceIds, "EV01"] },
    {
      ...caseReport,
      eventOrder: [
        caseReport.eventOrder[0],
        ...caseReport.eventOrder.slice(0, 5),
      ],
    },
    { ...caseReport, motive: "research-credit" },
    {
      ...caseReport,
      rejectedTheories: ["database", "malfunction"],
      alternativeReasoning: {
        database: caseReport.alternativeReasoning.database,
        malfunction:
          "EV24 alone does not establish that a computer fault caused the access.",
      },
    },
  ]) {
    assert.equal(
      (
        await post(
          "/api/investigation/case/report",
          invalidReport,
          detectiveCookie,
        )
      ).status,
      422,
    );
  }
  const shortAlternativeReasoning = await post(
    "/api/investigation/case/report",
    {
      ...caseReport,
      alternativeReasoning: {
        ...caseReport.alternativeReasoning,
        contractor: "Gabriel's repair ended earlier.",
      },
    },
    detectiveCookie,
  );
  assert.equal(shortAlternativeReasoning.status, 400);

  const submission = await post(
    "/api/investigation/case/report",
    caseReport,
    detectiveCookie,
  );
  assert.equal(submission.status, 201);
  const proposed = (await submission.json()).state.gameState.report;
  assert.deepEqual(proposed.approvals, ["detective"]);
  const expectedScore = Math.max(0, 100 - 5 * readyState.wrongAttempts - 35);
  assert.equal(proposed.score, expectedScore);
  assert.equal(
    (await post("/api/investigation/case/report/approve", {}, detectiveCookie))
      .status,
    409,
  );
  const approval = await post(
    "/api/investigation/case/report/approve",
    {},
    analystCookie,
  );
  assert.equal(approval.status, 200);
  assert.deepEqual(
    (await approval.json()).state.gameState.report.approvals.sort(),
    ["analyst", "detective"],
  );
  const score = await ScoreEntry.findOne({
    teamId,
    round: 3,
    game: "investigation",
    kind: "game_result",
  }).lean();
  assert.equal(score.amount, expectedScore);
});

test("report submission also works when players choose to save separate assessments", async () => {
  const { detectiveCookie, analystCookie } = await prepareReportReadyCase(
    "case-helix-report-with-assessments",
  );
  for (const [theoryId, evidenceIds] of [
    ["database", ["EV03", "EV11"]],
    ["contractor", ["EV14", "EV18"]],
  ]) {
    const assessment = await post(
      `/api/investigation/case/hypotheses/${theoryId}`,
      { status: "contradicted", evidenceIds },
      detectiveCookie,
    );
    assert.equal(assessment.status, 200);
  }

  const submission = await post(
    "/api/investigation/case/report",
    validCaseReport(),
    detectiveCookie,
  );
  assert.equal(submission.status, 201);
  assert.equal((await submission.json()).state.gameState.report.score, 100);
  assert.equal(
    (await post("/api/investigation/case/report/approve", {}, analystCookie))
      .status,
    200,
  );
  const score = await ScoreEntry.findOne({
    teamId,
    round: 3,
    game: "investigation",
    kind: "game_result",
  }).lean();
  assert.equal(score.amount, 100);
});

test("legacy evidence 2 and 3 can be collected by either role while evidence 1 is detective-only", async () => {
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

  const retiredAccusation = await post(
    "/api/investigation/accusation",
    {
      suspect: "Idris Khan",
      evidenceKey: "ev2",
      reasoning: "Legacy accusations cannot finalize the complete case.",
    },
    detectiveCookie,
  );
  assert.equal(retiredAccusation.status, 410);
  assert.equal(
    (await post("/api/investigation/accusation/approve", {}, analystCookie))
      .status,
    410,
  );
  assert.equal((await getCase()).accusation, null);
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
  assert.equal(savedCase.finalResult.accusation, null);
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
  assert.equal(result.accusation, null);
  assert.ok(result.roundEndedAt);
});

test("the analyst cannot finalize through the retired accusation endpoints", async () => {
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
          reasoning: "A legacy guess is not a validated case report.",
        },
        analystCookie,
      )
    ).status,
    410,
  );
  assert.equal((await getCase()).accusation, null);
  await endRound(3, "investigation-branch-test");
  const finalResult = (await getCase()).finalResult;
  assert.equal(finalResult.accusation, null);
});

test("final result does not persist a retired, unvalidated accusation", async () => {
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
          reasoning: "A guess cannot replace the structured report.",
        },
        analystCookie,
      )
    ).status,
    410,
  );
  await endRound(3, "investigation-branch-test");
  const finalAccusation = (await getCase()).finalResult.accusation;
  assert.equal(finalAccusation, null);
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

