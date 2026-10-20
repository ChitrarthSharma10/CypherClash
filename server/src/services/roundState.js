import { EventEmitter } from "node:events";
import { InvestigationCase } from "../models/InvestigationCase.js";
import { RoundState } from "../models/RoundState.js";
import { logEvent } from "../utils/logging.js";

const states = new Map();
const roundStateEvents = new EventEmitter();
let transitionLock = Promise.resolve();
let monitor;

export function onRoundStateChange(listener) {
  roundStateEvents.on("change", listener);
  return () => roundStateEvents.off("change", listener);
}

export class RoundStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RoundStateError";
    this.code = code;
  }
}

function snapshot(state) {
  return {
    round: state.round,
    attemptNo: state.attemptNo ?? 1,
    status: state.status,
    startedAt: state.startedAt,
    deadline: state.deadline,
    durationSec: state.durationSec,
    pausedAt: state.pausedAt,
    endedAt: state.endedAt,
  };
}

async function finalizeRound3State(filter, endedAt, close = false) {
  const approvals = (role) => ({
    $in: [role, { $ifNull: ["$$investigation.accusation.approvals", []] }],
  });
  const detectiveApproved = approvals("detective");
  const analystApproved = approvals("analyst");
  const set = {
    investigations: {
      $map: {
        input: { $ifNull: ["$investigations", []] },
        as: "investigation",
        in: {
          $cond: [
            {
              $and: [
                { $eq: ["$$investigation.attemptNo", "$attemptNo"] },
                {
                  $eq: [
                    { $ifNull: ["$$investigation.finalResult", null] },
                    null,
                  ],
                },
              ],
            },
            {
              $mergeObjects: [
                "$$investigation",
                {
                  finalResult: {
                    evidence: { $ifNull: ["$$investigation.clues", []] },
                    decryption: {
                      succeeded: { $eq: ["$$investigation.decrypted", true] },
                      succeededAt: {
                        $ifNull: ["$$investigation.decryptedAt", null],
                      },
                    },
                    accusation: {
                      $cond: [
                        {
                          $eq: [
                            {
                              $ifNull: ["$$investigation.accusation", null],
                            },
                            null,
                          ],
                        },
                        null,
                        {
                          submitted: {
                            $and: [detectiveApproved, analystApproved],
                          },
                          suspect: "$$investigation.accusation.suspect",
                          evidenceKey: "$$investigation.accusation.evidenceKey",
                          reasoning: "$$investigation.accusation.reasoning",
                          initiatedBy: "$$investigation.accusation.submittedBy",
                          initiatedAt: "$$investigation.accusation.submittedAt",
                          approvals: {
                            detective: detectiveApproved,
                            analyst: analystApproved,
                          },
                          agreed: {
                            $and: [detectiveApproved, analystApproved],
                          },
                        },
                      ],
                    },
                    roundEndedAt: endedAt,
                  },
                },
              ],
            },
            "$$investigation",
          ],
        },
      },
    },
  };
  if (close) {
    set.status = "ended";
    set.endedAt = endedAt;
    set.pausedAt = null;
    set.updatedAt = "$$NOW";
  }
  set.revision = { $add: [{ $ifNull: ["$revision", 0] }, 1] };
  return RoundState.findOneAndUpdate(filter, [{ $set: set }], {
    new: true,
    timestamps: false,
  }).lean();
}

export function round3AdmissionFilter(attemptNo) {
  return {
    round: 3,
    attemptNo,
    status: "running",
    $expr: { $gt: ["$deadline", "$$NOW"] },
  };
}

export async function updateRound3Investigation(attemptNo, caseFilter, update) {
  const state = await RoundState.findOneAndUpdate(
    {
      ...round3AdmissionFilter(attemptNo),
      investigations: { $elemMatch: caseFilter },
    },
    {
      ...update,
      $inc: { ...update.$inc, revision: 1 },
    },
    { new: true, runValidators: true },
  ).lean();
  return (
    state?.investigations?.find(
      (investigation) =>
        investigation.teamId === caseFilter.teamId &&
        investigation.attemptNo === attemptNo,
    ) || null
  );
}

export async function claimRound3Investigation(attemptNo, investigation) {
  const state = await RoundState.findOneAndUpdate(
    {
      ...round3AdmissionFilter(attemptNo),
      investigations: {
        $not: {
          $elemMatch: {
            teamId: investigation.teamId,
            attemptNo,
          },
        },
      },
    },
    {
      $push: { investigations: investigation },
      $inc: { revision: 1 },
    },
    { new: true, runValidators: true },
  ).lean();
  return (
    state?.investigations?.find(
      (entry) =>
        entry.teamId === investigation.teamId && entry.attemptNo === attemptNo,
    ) || null
  );
}

export async function getRound3State() {
  return RoundState.findOne({ round: 3 })
    .select("+investigations.inviteHash")
    .lean();
}

async function migrateLegacyInvestigationCases() {
  const legacyCases = await InvestigationCase.find({ round: 3 })
    .select("+inviteHash")
    .lean();
  for (const legacyCase of legacyCases) {
    const { _id, __v, ...investigation } = legacyCase;
    while (true) {
      const state = await RoundState.findOne({ round: 3 }).lean();
      if (!state) {
        throw new Error("Cannot migrate Round 3 cases without RoundState");
      }
      const alreadyMigrated = state.investigations?.some(
        (entry) =>
          entry.teamId === investigation.teamId &&
          entry.attemptNo === investigation.attemptNo,
      );
      if (alreadyMigrated) break;

      if (
        state.status === "ended" &&
        investigation.attemptNo === (state.attemptNo ?? 1) &&
        !investigation.finalResult
      ) {
        investigation.finalResult = legacyFinalResult(
          investigation,
          state.endedAt ?? state.updatedAt ?? new Date(),
        );
      }

      const migrated = await RoundState.updateOne(
        {
          round: 3,
          status: state.status,
          attemptNo: state.attemptNo ?? 1,
          investigations: {
            $not: {
              $elemMatch: {
                teamId: investigation.teamId,
                attemptNo: investigation.attemptNo,
              },
            },
          },
        },
        { $push: { investigations: investigation } },
        { timestamps: false },
      );
      if (migrated.modifiedCount === 1) break;
    }
  }
}

function legacyFinalResult(investigation, endedAt) {
  const approvals = new Set(investigation.accusation?.approvals || []);
  return {
    evidence: investigation.clues || [],
    decryption: {
      succeeded: investigation.decrypted === true,
      succeededAt: investigation.decryptedAt || null,
    },
    accusation: investigation.accusation
      ? {
          submitted: approvals.has("detective") && approvals.has("analyst"),
          suspect: investigation.accusation.suspect,
          evidenceKey: investigation.accusation.evidenceKey,
          reasoning: investigation.accusation.reasoning,
          initiatedBy: investigation.accusation.submittedBy,
          initiatedAt: investigation.accusation.submittedAt,
          approvals: {
            detective: approvals.has("detective"),
            analyst: approvals.has("analyst"),
          },
          agreed: approvals.has("detective") && approvals.has("analyst"),
        }
      : null,
    roundEndedAt: endedAt,
  };
}

async function saveState(state, expected, extraFilter = {}) {
  const values = snapshot(state);
  const set = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
  const unset = Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value === undefined)
      .map(([key]) => [key, 1]),
  );
  const filter = expected
    ? {
        round: state.round,
        status: expected.status,
        attemptNo: expected.attemptNo ?? 1,
        ...extraFilter,
      }
    : { round: state.round, ...extraFilter };
  const saved = await RoundState.findOneAndUpdate(
    filter,
    { $set: set, $unset: unset },
    {
      upsert: !expected,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
  if (!saved) {
    throw new RoundStateError(
      "ROUND_STATE_CHANGED",
      "Round state changed before the operation completed",
    );
  }
  return saved.toObject();
}

export async function initializeRoundStates() {
  await migrateLegacyInvestigationCases();
  states.clear();
  const savedStates = await RoundState.find().sort({ round: 1 }).lean();
  for (const state of savedStates) {
    states.set(state.round, state);
  }
  const endedRound3 = states.get(3);
  if (endedRound3?.status === "ended") {
    await finalizeRound3State(
      { round: 3, status: "ended" },
      { $ifNull: ["$endedAt", "$updatedAt", "$$NOW"] },
    );
  }
  await autoEndExpiredRounds();
  states.clear();
  const currentStates = await RoundState.find().sort({ round: 1 }).lean();
  for (const state of currentStates) {
    states.set(state.round, state);
  }
  const activeStates = [...states.values()].filter(
    (state) => state.status === "running" || state.status === "paused",
  );
  if (activeStates.length > 1) {
    throw new RoundStateError(
      "MULTIPLE_ACTIVE_ROUNDS",
      "Database contains more than one running or paused round",
    );
  }
  return listRoundStates();
}

export function listRoundStates() {
  return [...states.values()]
    .sort((first, second) => first.round - second.round)
    .map(snapshot);
}

export function getRoundState(round) {
  const state = states.get(round);
  return state ? snapshot(state) : null;
}

export function getRunningRound() {
  return (
    [...states.values()]
      .filter(
        (state) =>
          state.status === "running" && state.deadline?.getTime() > Date.now(),
      )
      .sort((first, second) => first.round - second.round)[0] || null
  );
}

async function updateState(round, changes, actorId, eventType, extraFilter) {
  const existing = states.get(round);
  const current = existing || {
    round,
    status: "not_started",
    startedAt: undefined,
    deadline: undefined,
    durationSec: undefined,
    pausedAt: undefined,
    endedAt: undefined,
  };
  const oldState = snapshot(current);
  const next = { ...current, ...changes };
  states.set(round, next);
  try {
    const saved = await saveState(next, existing, extraFilter);
    states.set(round, saved);
  } catch (error) {
    if (states.get(round) === next) {
      if (existing) states.set(round, existing);
      else states.delete(round);
    }
    throw error;
  }
  const savedState = states.get(round);
  roundStateEvents.emit('change', snapshot(savedState));
  const effectiveActorId = actorId || 'system';
  await logEvent({
    type: eventType,
    actorType: effectiveActorId === 'system' ? 'system' : 'admin',
    actorId: effectiveActorId,
    details: { old: oldState, new: snapshot(savedState) },
  });
  return snapshot(savedState);
}

async function withTransitionLock(operation) {
  const previous = transitionLock;
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  transitionLock = current;
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

export async function startRound(round, durationSec, adminId = 'system') {
  return withTransitionLock(async () => {
    const current = states.get(round);
    if (current?.status === "running" || current?.status === "paused") {
      throw new RoundStateError(
        "ROUND_ALREADY_STARTED",
        "Round has already started",
      );
    }
    const otherActiveRound = [...states.values()].find(
      (state) =>
        state.round !== round &&
        (state.status === "running" || state.status === "paused"),
    );
    if (otherActiveRound) {
      throw new RoundStateError(
        "ROUND_ALREADY_STARTED",
        `Round ${otherActiveRound.round} is already running or paused`,
      );
    }
    const startedAt = new Date();
    return updateState(
      round,
      {
        attemptNo:
          current?.status === "ended"
            ? (current.attemptNo ?? 1) + 1
            : (current?.attemptNo ?? 1),
        status: "running",
        startedAt,
        deadline: new Date(startedAt.getTime() + durationSec * 1000),
        durationSec,
        pausedAt: undefined,
        endedAt: undefined,
      },
      adminId,
      "round started",
    );
  });
}

export async function pauseRound(round, adminId = 'system') {
  return withTransitionLock(async () => {
    const current = states.get(round);
    if (!current || current.status !== "running") {
      throw new RoundStateError("ROUND_NOT_RUNNING", "Round is not running");
    }
    return updateState(
      round,
      { status: "paused", pausedAt: new Date() },
      adminId,
      "round paused",
      round === 3 ? { $expr: { $gt: ["$deadline", "$$NOW"] } } : undefined,
    );
  });
}

export async function resumeRound(round, adminId = 'system') {
  return withTransitionLock(async () => {
    const current = states.get(round);
    if (
      !current ||
      current.status !== "paused" ||
      !current.pausedAt ||
      !current.deadline
    ) {
      throw new RoundStateError("ROUND_NOT_PAUSED", "Round is not paused");
    }
    const pauseLength = Date.now() - current.pausedAt.getTime();
    return updateState(
      round,
      {
        status: "running",
        deadline: new Date(current.deadline.getTime() + pauseLength),
        pausedAt: undefined,
      },
      adminId,
      "round resumed",
    );
  });
}

export async function endRound(round, adminId = 'system') {
  return withTransitionLock(async () => {
    const current = states.get(round);
    if (round === 3) {
      const endedAt = {
        $cond: [
          {
            $and: [
              { $eq: ["$status", "running"] },
              { $lte: ["$deadline", "$$NOW"] },
            ],
          },
          "$deadline",
          "$$NOW",
        ],
      };
      const ended = await finalizeRound3State(
        {
          round: 3,
          attemptNo: current?.attemptNo ?? 1,
          status: { $in: ["running", "paused"] },
        },
        endedAt,
        true,
      );
      if (!ended) {
        const persisted = await RoundState.findOne({ round: 3 }).lean();
        if (persisted) states.set(3, persisted);
        throw new RoundStateError("ROUND_NOT_ACTIVE", "Round is not active");
      }
      states.set(3, ended);
      const oldState = snapshot(current || ended);
      roundStateEvents.emit("change", snapshot(ended));
      await logEvent({
        type: "round ended",
        actorType: adminId === "system" ? "system" : "admin",
        actorId: adminId,
        details: { old: oldState, new: snapshot(ended) },
      });
      return snapshot(ended);
    }
    if (
      !current ||
      (current.status !== "running" && current.status !== "paused")
    ) {
      throw new RoundStateError("ROUND_NOT_ACTIVE", "Round is not active");
    }
    const endedAt =
      current.status === "running" && current.deadline?.getTime() <= Date.now()
        ? current.deadline
        : new Date();
    return updateState(
      round,
      { status: "ended", pausedAt: undefined, endedAt },
      adminId,
      "round ended",
    );
  });
}

export async function autoEndExpiredRounds() {
  const expiredRound3 = await RoundState.findOne({
    round: 3,
    status: "running",
    $expr: { $lte: ["$deadline", "$$NOW"] },
  }).lean();
  if (expiredRound3) {
    await withTransitionLock(async () => {
      const ended = await finalizeRound3State(
        {
          round: 3,
          attemptNo: expiredRound3.attemptNo ?? 1,
          status: "running",
          $expr: { $lte: ["$deadline", "$$NOW"] },
        },
        "$deadline",
        true,
      );
      if (ended) {
        const oldState = snapshot(states.get(3) || expiredRound3);
        states.set(3, ended);
        roundStateEvents.emit("change", snapshot(ended));
        await logEvent({
          type: "round ended",
          actorType: "system",
          actorId: "system",
          details: { old: oldState, new: snapshot(ended) },
        });
      }
    });
  }

  const now = Date.now();
  for (const state of states.values()) {
    if (
      state.round !== 3 &&
      state.status === "running" &&
      state.deadline &&
      state.deadline.getTime() <= now
    ) {
      await withTransitionLock(async () => {
        const current = states.get(state.round);
        if (
          current?.status === "running" &&
          current.deadline?.getTime() <= Date.now()
        ) {
          await updateState(
            state.round,
            { status: "ended", endedAt: current.deadline },
            "system",
            "round ended",
          );
        }
      });
    }
  }
}

export function startRoundStateMonitor() {
  if (!monitor) {
    monitor = setInterval(() => {
      autoEndExpiredRounds().catch((error) =>
        console.error("Failed to auto-end round", error),
      );
    }, 1000);
    monitor.unref?.();
  }
  return monitor;
}
