import { randomInt } from 'node:crypto';
import { z } from 'zod';

const OPERATIONS = {
  AND: (first, second) => first && second,
  OR: (first, second) => first || second,
  XOR: (first, second) => first !== second,
  NAND: (first, second) => !(first && second),
  NOR: (first, second) => !(first || second),
};
const OPERATION_NAMES = Object.keys(OPERATIONS);
const STAGES = [
  { switches: 4, hidden: 1, lamps: 2 },
  { switches: 5, hidden: 2, lamps: 3 },
  { switches: 6, hidden: 3, lamps: 4 },
];
const MAX_WRONG = 3;
const LOCK_MS = 3000;

function pick(values) {
  return values[randomInt(values.length)];
}

function evaluate(gates, inputs) {
  const nodes = [...inputs];
  for (const gate of gates) {
    nodes.push(OPERATIONS[gate.op](nodes[gate.a], nodes[gate.b]));
  }
  return nodes;
}

function buildStage(config) {
  const total = config.switches + config.hidden + config.lamps;
  const gates = [];
  for (let index = config.switches; index < total; index += 1) {
    const first = randomInt(index);
    let second = randomInt(index);
    while (second === first) second = randomInt(index);
    gates.push({ op: pick(OPERATION_NAMES), a: first, b: second });
  }
  const secret = Array.from({ length: config.switches }, () => randomInt(2) === 1);
  const nodes = evaluate(gates, secret);
  const target = nodes.slice(total - config.lamps);
  return {
    config,
    gates,
    target,
    switches: Array(config.switches).fill(false),
    wrong: 0,
    lockedUntil: 0,
  };
}

export function createGame(now = Date.now()) {
  return {
    stageIndex: 0,
    stage: buildStage(STAGES[0]),
    points: 0,
    stageStart: now,
    done: false,
    log: [],
  };
}

export function view(game, slot, now = Date.now()) {
  if (game.done) return { done: true, points: game.points };
  const stage = game.stage;
  const base = {
    stage: game.stageIndex + 1,
    stages: STAGES.length,
    wrong: stage.wrong,
    maxWrong: MAX_WRONG,
  };
  if (slot === 'P1') {
    return {
      ...base,
      role: 'analyst',
      switchCount: stage.config.switches,
      gates: stage.gates.map((gate) => ({ ...gate })),
      lampCount: stage.config.lamps,
      target: [...stage.target],
    };
  }
  return {
    ...base,
    role: 'operator',
    switches: [...stage.switches],
    lockedMs: Math.max(0, stage.lockedUntil - now),
    lastFeedback: stage.lastFeedback ? { ...stage.lastFeedback } : null,
  };
}

function toggle(game, slot, { idx }) {
  if (game.done || slot !== 'P2') return { ok: false, error: 'not_allowed' };
  if (!Number.isInteger(idx) || idx < 0 || idx >= game.stage.switches.length) {
    return { ok: false, error: 'bad_input' };
  }
  game.stage.switches[idx] = !game.stage.switches[idx];
  return { ok: true, changed: true };
}

function submit(game, slot, _payload, now = Date.now()) {
  if (game.done || slot !== 'P2') return { ok: false, error: 'not_allowed' };
  const stage = game.stage;
  if (now < stage.lockedUntil) return { ok: false, error: 'locked' };
  const nodes = evaluate(stage.gates, stage.switches);
  const lamps = nodes.slice(nodes.length - stage.config.lamps);
  const correct = lamps.filter((value, index) => value === stage.target[index]).length;
  if (correct === stage.config.lamps) {
    const seconds = (now - game.stageStart) / 1000;
    const bonus = Math.max(0, Math.round(60 - seconds / 2));
    const gained = Math.max(20, 100 + bonus - 20 * stage.wrong);
    game.points += gained;
    game.log.push({ stage: game.stageIndex + 1, gained, wrong: stage.wrong });
    game.stageIndex += 1;
    if (game.stageIndex >= STAGES.length) {
      game.done = true;
      return { ok: true, solved: true, finished: true, points: game.points, changed: true };
    }
    game.stage = buildStage(STAGES[game.stageIndex]);
    game.stageStart = now;
    return { ok: true, solved: true, finished: false, changed: true };
  }

  stage.wrong += 1;
  stage.lockedUntil = now + LOCK_MS;
  stage.lastFeedback = { correct, of: stage.config.lamps };
  if (stage.wrong >= MAX_WRONG) {
    game.stage = buildStage(STAGES[game.stageIndex]);
    game.stage.wrong = MAX_WRONG;
    game.stage.lockedUntil = now + LOCK_MS;
    return { ok: true, solved: false, reset: true, changed: true };
  }
  return { ok: true, solved: false, feedback: stage.lastFeedback, changed: true };
}

export const gameModule = {
  createGame,
  view,
  events: {
    'cs:toggle': {
      schema: z.object({ idx: z.number().int().min(0).max(5) }).strict(),
      handle: toggle,
    },
    'cs:submit': {
      schema: z.object({}).strict(),
      handle: submit,
    },
  },
};
