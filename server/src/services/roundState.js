import { EventEmitter } from 'node:events';
import { RoundState } from '../models/RoundState.js';
import { logEvent } from '../utils/logging.js';

const states = new Map();
const roundStateEvents = new EventEmitter();
let transitionLock = Promise.resolve();
let monitor;

export function onRoundStateChange(listener) {
  roundStateEvents.on('change', listener);
  return () => roundStateEvents.off('change', listener);
}

export class RoundStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RoundStateError';
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
  };
}

async function saveState(state) {
  const values = snapshot(state);
  const set = Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
  const unset = Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value === undefined)
      .map(([key]) => [key, 1]),
  );
  await RoundState.findOneAndUpdate(
    { round: state.round },
    { $set: set, $unset: unset },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

export async function initializeRoundStates() {
  states.clear();
  const savedStates = await RoundState.find().sort({ round: 1 }).lean();
  for (const state of savedStates) {
    states.set(state.round, state);
  }
  const activeStates = savedStates.filter(
    (state) => state.status === 'running' || state.status === 'paused',
  );
  if (activeStates.length > 1) {
    throw new RoundStateError(
      'MULTIPLE_ACTIVE_ROUNDS',
      'Database contains more than one running or paused round',
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
  return [...states.values()]
    .filter((state) => state.status === 'running' && state.deadline?.getTime() > Date.now())
    .sort((first, second) => first.round - second.round)[0] || null;
}

async function updateState(round, changes, actorId, eventType) {
  const existing = states.get(round);
  const current = existing || {
    round,
    status: 'not_started',
    startedAt: undefined,
    deadline: undefined,
    durationSec: undefined,
    pausedAt: undefined,
  };
  const oldState = snapshot(current);
  const next = { ...current, ...changes };
  states.set(round, next);
  try {
    await saveState(next);
  } catch (error) {
    if (states.get(round) === next) {
      if (existing) states.set(round, existing);
      else states.delete(round);
    }
    throw error;
  }
  roundStateEvents.emit('change', snapshot(next));
  const effectiveActorId = actorId || 'system';
  await logEvent({
    type: eventType,
    actorType: effectiveActorId === 'system' ? 'system' : 'admin',
    actorId: effectiveActorId,
    details: { old: oldState, new: snapshot(next) },
  });
  return snapshot(next);
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
    if (current?.status === 'running' || current?.status === 'paused') {
      throw new RoundStateError('ROUND_ALREADY_STARTED', 'Round has already started');
    }
    const otherActiveRound = [...states.values()].find(
      (state) => state.round !== round
        && (state.status === 'running' || state.status === 'paused'),
    );
    if (otherActiveRound) {
      throw new RoundStateError(
        'ROUND_ALREADY_STARTED',
        `Round ${otherActiveRound.round} is already running or paused`,
      );
    }
    const startedAt = new Date();
    return updateState(
      round,
      {
        attemptNo: current?.status === 'ended'
          ? (current.attemptNo ?? 1) + 1
          : current?.attemptNo ?? 1,
        status: 'running',
        startedAt,
        deadline: new Date(startedAt.getTime() + durationSec * 1000),
        durationSec,
        pausedAt: undefined,
      },
      adminId,
      'round started',
    );
  });
}

export async function pauseRound(round, adminId = 'system') {
  return withTransitionLock(async () => {
    const current = states.get(round);
    if (!current || current.status !== 'running') {
      throw new RoundStateError('ROUND_NOT_RUNNING', 'Round is not running');
    }
    return updateState(round, { status: 'paused', pausedAt: new Date() }, adminId, 'round paused');
  });
}

export async function resumeRound(round, adminId = 'system') {
  return withTransitionLock(async () => {
    const current = states.get(round);
    if (!current || current.status !== 'paused' || !current.pausedAt || !current.deadline) {
      throw new RoundStateError('ROUND_NOT_PAUSED', 'Round is not paused');
    }
    const pauseLength = Date.now() - current.pausedAt.getTime();
    return updateState(
      round,
      {
        status: 'running',
        deadline: new Date(current.deadline.getTime() + pauseLength),
        pausedAt: undefined,
      },
      adminId,
      'round resumed',
    );
  });
}

export async function endRound(round, adminId = 'system') {
  return withTransitionLock(async () => {
    const current = states.get(round);
    if (!current || (current.status !== 'running' && current.status !== 'paused')) {
      throw new RoundStateError('ROUND_NOT_ACTIVE', 'Round is not active');
    }
    return updateState(round, { status: 'ended', pausedAt: undefined }, adminId, 'round ended');
  });
}

export async function autoEndExpiredRounds() {
  const now = Date.now();
  for (const state of states.values()) {
    if (state.status === 'running' && state.deadline && state.deadline.getTime() <= now) {
      await withTransitionLock(async () => {
        const current = states.get(state.round);
        if (current?.status === 'running' && current.deadline?.getTime() <= Date.now()) {
          await updateState(state.round, { status: 'ended' }, 'system', 'round ended');
        }
      });
    }
  }
}

export function startRoundStateMonitor() {
  if (!monitor) {
    monitor = setInterval(() => {
      autoEndExpiredRounds().catch((error) => console.error('Failed to auto-end round', error));
    }, 1000);
    monitor.unref?.();
  }
  return monitor;
}
