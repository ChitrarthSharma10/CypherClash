import "./bootstrap.js";
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { connectDatabase, disconnectDatabase } from "../src/db.js";
import { createApp } from "../src/app.js";
import { sessionStore } from "../src/sessionStore.js";
import { GameSession } from "../src/models/GameSession.js";
import { Team } from "../src/models/Team.js";
import { ScoreEntry } from "../src/models/ScoreEntry.js";
import { RoundState } from "../src/models/RoundState.js";
import { EventLog } from "../src/models/EventLog.js";
import {
  endRound,
  initializeRoundStates,
  pauseRound,
  resumeRound,
  startRound,
} from "../src/services/roundState.js";
import { clearAllTotalsCache } from "../src/services/scoring.js";
import { gameValidators } from "../src/games/validators.js";
import { hashPassword } from "../src/utils/passwords.js";

const suffix = `${Date.now() % 1_000_000_000}${process.pid % 10000}`;
const teamA = `CC-93${suffix}`;
const teamB = `CC-94${suffix}`;
const password = "GameSessionTestPassword123";
const round = Date.now() * 10 + (process.pid % 10);
let server;
let baseUrl;

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function teamCookie(teamId) {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ teamId, password }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";", 1)[0];
}

async function startGame(cookie, game = "maze") {
  return request(`/api/games/${game}/start`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: "{}",
  });
}

async function finishGame(cookie, body = { inputs: [] }, game = "maze") {
  return request(`/api/games/${game}/finish`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await connectDatabase();
  await GameSession.syncIndexes();
  await ScoreEntry.syncIndexes();
  await Team.create({
    teamId: teamA,
    name: `Test ${teamA}`,
    passwordHash: await hashPassword(password),
  });
  await Team.create({
    teamId: teamB,
    name: `Test ${teamB}`,
    passwordHash: await hashPassword(password),
  });
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await GameSession.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await ScoreEntry.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await RoundState.deleteMany({ round });
  await EventLog.deleteMany({
    actorId: { $in: [teamA, teamB, "game-service"] },
  });
  clearAllTotalsCache();
  await initializeRoundStates();
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await GameSession.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await ScoreEntry.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await Team.deleteMany({ teamId: { $in: [teamA, teamB] } });
  await RoundState.deleteMany({ round });
  await EventLog.deleteMany({
    actorId: { $in: [teamA, teamB, "game-service"] },
  });
  await sessionStore.close();
  await disconnectDatabase();
});

test("starting a game is idempotent and returns no solution data", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  const firstResponse = await startGame(cookie);
  const secondResponse = await startGame(cookie);
  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  const first = await firstResponse.json();
  const second = await secondResponse.json();
  assert.equal(first.seed, second.seed);
  assert.equal(first.startedAt, second.startedAt);
  assert.equal(first.deadline, second.deadline);
  assert.ok(first.serverNow);
  assert.deepEqual(Object.keys(first).sort(), [
    "deadline",
    "seed",
    "serverNow",
    "startedAt",
  ]);
});

test("game start requires team authentication and a whitelisted game", async () => {
  const unauthenticated = await request("/api/games/maze/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(unauthenticated.status, 401);

  const cookie = await teamCookie(teamA);
  const invalidGame = await startGame(cookie, "unknown");
  assert.equal(invalidGame.status, 400);
});

test("game start requires a running round", async () => {
  const cookie = await teamCookie(teamA);
  const response = await startGame(cookie);
  assert.equal(response.status, 409);
});

test("Circuit Sync can only start during Round 1", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  const response = await startGame(cookie, "circuit");
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "GAME_NOT_AVAILABLE_FOR_ROUND");
});

test("circuit switch inputs require an index", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  const response = await finishGame(cookie, {
    inputs: [{ type: "toggle", timestamp: 100 }],
  });
  assert.equal(response.status, 400);
});

test("GameSession has one partial unique index for active and submitted attempts", async () => {
  const indexes = await GameSession.collection.indexes();
  const gameSessionIndex = indexes.find(
    (index) => index.name === "teamId_1_round_1_attemptNo_1_game_1",
  );
  assert.ok(gameSessionIndex);
  assert.equal(gameSessionIndex.unique, true);
  assert.deepEqual(gameSessionIndex.key, {
    teamId: 1,
    round: 1,
    attemptNo: 1,
    game: 1,
  });
  assert.deepEqual(gameSessionIndex.partialFilterExpression, {
    status: { $in: ["active", "submitted"] },
  });
});

test("finish before game start fails", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  const response = await finishGame(cookie);
  assert.equal(response.status, 404);
});

test("double finish scores only once", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  const started = await startGame(cookie);
  assert.equal(started.status, 200);
  const originalValidator = gameValidators.get("maze");
  gameValidators.set("maze", async () => ({ ok: true, points: 37 }));
  try {
    const [first, second] = await Promise.all([
      finishGame(cookie),
      finishGame(cookie),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal((await finishGame(cookie)).status, 409);
    assert.equal(
      await ScoreEntry.countDocuments({
        teamId: teamA,
        round,
        kind: "game_result",
      }),
      1,
    );
  } finally {
    gameValidators.set("maze", originalValidator);
  }
});

test("validator rejection leaves the session active and logs only the reason", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  const originalValidator = gameValidators.get("maze");
  gameValidators.set("maze", async (_seed, inputs, elapsedMs) => ({
    ok: false,
    reason:
      inputs[0].timestamp > elapsedMs
        ? "input timestamp exceeds elapsed time"
        : "impossible move",
  }));
  try {
    const response = await finishGame(cookie, {
      inputs: [{ type: "move", timestamp: Number.MAX_SAFE_INTEGER }],
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "GAME_VALIDATION_REJECTED");
    assert.equal(
      (await GameSession.findOne({ teamId: teamA, round })).status,
      "active",
    );
    const event = await EventLog.findOne({
      type: "game validation rejected",
      teamId: teamA,
    }).lean();
    assert.equal(event.details.reason, "input timestamp exceeds elapsed time");
    assert.equal(event.details.inputs, undefined);
  } finally {
    gameValidators.set("maze", originalValidator);
  }
});

test("scoring failure marks the session failed and writes a failure event", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  const originalValidator = gameValidators.get("maze");
  const originalCreate = ScoreEntry.create;
  gameValidators.set("maze", async () => ({ ok: true, points: 37 }));
  ScoreEntry.create = async () => {
    throw new Error("test scoring failure");
  };
  try {
    const response = await finishGame(cookie);
    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, "GAME_SCORING_FAILED");
    const session = await GameSession.findOne({ teamId: teamA, round }).lean();
    assert.equal(session.status, "failed");
    assert.equal(session.failureReason, "test scoring failure");
    const event = await EventLog.findOne({
      type: "game scoring failed",
      teamId: teamA,
    }).lean();
    assert.equal(event.details.reason, "test scoring failure");
  } finally {
    ScoreEntry.create = originalCreate;
    gameValidators.set("maze", originalValidator);
  }
});

test("finish during a pause uses paused-time-adjusted elapsed duration", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  await pauseRound(round, "game-test-admin");
  const originalValidator = gameValidators.get("maze");
  let measuredElapsed;
  gameValidators.set("maze", async (_seed, _inputs, elapsedMs) => {
    measuredElapsed = elapsedMs;
    return { ok: true, points: 24 };
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const response = await finishGame(cookie);
    assert.equal(response.status, 200);
    assert.ok(
      measuredElapsed < 1000,
      `elapsed ${measuredElapsed}ms included paused time`,
    );
  } finally {
    gameValidators.set("maze", originalValidator);
  }
});

test("finish after a pause and resume succeeds", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  await pauseRound(round, "game-test-admin");
  await new Promise((resolve) => setTimeout(resolve, 30));
  await resumeRound(round, "game-test-admin");
  const originalValidator = gameValidators.get("maze");
  gameValidators.set("maze", async () => ({ ok: true, points: 31 }));
  try {
    const response = await finishGame(cookie);
    assert.equal(response.status, 200);
    assert.equal(await ScoreEntry.countDocuments({ teamId: teamA, round }), 1);
  } finally {
    gameValidators.set("maze", originalValidator);
  }
});

test("finish rejects elapsed active play beyond the configured game duration", async () => {
  await startRound(round, 600, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  await GameSession.updateOne(
    { teamId: teamA, round },
    { $set: { startedAt: new Date(Date.now() - 303_000) } },
  );
  const response = await finishGame(cookie);
  assert.equal(response.status, 410);
  assert.equal((await response.json()).code, "GAME_DEADLINE_PASSED");
  assert.equal(
    (await GameSession.findOne({ teamId: teamA, round })).status,
    "expired",
  );
});

test("a prior attempt session does not block starting the restarted attempt", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  const firstResponse = await startGame(cookie);
  const first = await firstResponse.json();
  await endRound(round, "game-test-admin");
  await startRound(round, 300, "game-test-admin");
  const secondResponse = await startGame(cookie);
  assert.equal(secondResponse.status, 200);
  const second = await secondResponse.json();
  assert.notEqual(first.seed, second.seed);
  const sessions = await GameSession.find({ teamId: teamA, round })
    .sort({ attemptNo: 1 })
    .lean();
  assert.deepEqual(
    sessions.map((session) => session.attemptNo),
    [1, 2],
  );
  assert.deepEqual(
    sessions.map((session) => session.status),
    ["active", "active"],
  );
});

test("a session cannot be started or scored after its round has ended", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  await endRound(round, "game-test-admin");
  const lateStart = await startGame(cookie);
  assert.equal(lateStart.status, 409);

  await GameSession.updateOne(
    { teamId: teamA, round, status: "active" },
    { $set: { status: "expired" } },
  );
  await GameSession.create({
    teamId: teamA,
    round,
    attemptNo: 1,
    game: "maze",
    seed: "test-seed",
    startedAt: new Date(),
    deadline: new Date(Date.now() + 60_000),
    status: "active",
  });
  const response = await finishGame(cookie);
  assert.equal(response.status, 410);
  assert.equal(await ScoreEntry.countDocuments({ teamId: teamA, round }), 0);
  assert.equal(
    (await GameSession.findOne({ teamId: teamA, round })).status,
    "expired",
  );
});

test("oversized game input bodies are rejected", async () => {
  const cookie = await teamCookie(teamA);
  const response = await request("/api/games/maze/finish", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ inputs: [], padding: "x".repeat(21_000) }),
  });
  assert.equal(response.status, 413);
});

test("finish after the deadline is rejected and expires the session", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  await RoundState.updateOne(
    { round },
    { $set: { deadline: new Date(Date.now() - 3000) } },
  );
  await initializeRoundStates();
  const response = await finishGame(cookie);
  assert.equal(response.status, 410);
  assert.equal(
    (await GameSession.findOne({ teamId: teamA, round })).status,
    "expired",
  );
});

test("client-sent points are rejected", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  const response = await finishGame(cookie, { inputs: [], points: 9999 });
  assert.equal(response.status, 400);
});

test("input fields and offsets are strictly validated", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  const response = await finishGame(cookie, {
    inputs: [{ type: "keydown", timestamp: -1, key: "ArrowRight" }],
  });
  assert.equal(response.status, 400);
});

test("another team cannot finish this team's session", async () => {
  await startRound(round, 300, "game-test-admin");
  const teamACookie = await teamCookie(teamA);
  const teamBCookie = await teamCookie(teamB);
  await startGame(teamACookie);
  const response = await finishGame(teamBCookie);
  assert.equal(response.status, 404);
});

test("registered validator stubs return 501 without scoring", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie, "runner");
  const response = await finishGame(cookie, { inputs: [] }, "runner");
  assert.equal(response.status, 501);
  assert.equal(await ScoreEntry.countDocuments({ teamId: teamA, round }), 0);
});

test("unregistered validators return 501", async () => {
  await startRound(round, 300, "game-test-admin");
  const cookie = await teamCookie(teamA);
  await startGame(cookie);
  const originalValidator = gameValidators.get("maze");
  gameValidators.delete("maze");
  try {
    const response = await finishGame(cookie);
    assert.equal(response.status, 501);
  } finally {
    gameValidators.set("maze", originalValidator);
  }
});
