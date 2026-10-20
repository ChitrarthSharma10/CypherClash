const OPERATIONS = Object.freeze({
  AND: (first, second) => first && second,
  OR: (first, second) => first || second,
  XOR: (first, second) => first !== second,
  XNOR: (first, second) => first === second,
  NAND: (first, second) => !(first && second),
  NOR: (first, second) => !(first || second),
  NOT: (first) => !first,
});

const STAGES = Object.freeze([
  Object.freeze({
    title: 'Three-switch warmup',
    switchCount: 3,
    gates: Object.freeze([
      Object.freeze({ op: 'OR', a: 0, b: 1 }),
      Object.freeze({ op: 'AND', a: 3, b: 2 }),
    ]),
    outputs: Object.freeze([Object.freeze({ node: 4, target: true })]),
  }),
  Object.freeze({
    title: 'Split logic',
    switchCount: 4,
    gates: Object.freeze([
      Object.freeze({ op: 'AND', a: 0, b: 1 }),
      Object.freeze({ op: 'XOR', a: 2, b: 3 }),
      Object.freeze({ op: 'AND', a: 4, b: 5 }),
    ]),
    outputs: Object.freeze([Object.freeze({ node: 6, target: true })]),
  }),
  Object.freeze({
    title: 'Dual targets',
    switchCount: 4,
    gates: Object.freeze([
      Object.freeze({ op: 'NAND', a: 0, b: 1 }),
      Object.freeze({ op: 'OR', a: 2, b: 3 }),
      Object.freeze({ op: 'AND', a: 1, b: 5 }),
    ]),
    outputs: Object.freeze([
      Object.freeze({ node: 4, target: false }),
      Object.freeze({ node: 6, target: true }),
    ]),
  }),
  Object.freeze({
    title: 'Inverter challenge',
    switchCount: 5,
    gates: Object.freeze([
      Object.freeze({ op: 'NOR', a: 0, b: 1 }),
      Object.freeze({ op: 'NOT', a: 2 }),
      Object.freeze({ op: 'AND', a: 5, b: 6 }),
      Object.freeze({ op: 'XOR', a: 3, b: 4 }),
      Object.freeze({ op: 'OR', a: 7, b: 8 }),
    ]),
    outputs: Object.freeze([Object.freeze({ node: 9, target: true })]),
  }),
  Object.freeze({
    title: 'Trap circuit',
    switchCount: 6,
    gates: Object.freeze([
      Object.freeze({ op: 'XOR', a: 0, b: 1 }),
      Object.freeze({ op: 'AND', a: 2, b: 3 }),
      Object.freeze({ op: 'NAND', a: 6, b: 7 }),
      Object.freeze({ op: 'XNOR', a: 4, b: 5 }),
      Object.freeze({ op: 'AND', a: 8, b: 9 }),
    ]),
    outputs: Object.freeze([Object.freeze({ node: 10, target: true })]),
  }),
]);

export const CIRCUIT_MAX_WRONG = 3;
export const CIRCUIT_LOCK_MS = 3000;
export const CIRCUIT_MIN_INPUT_INTERVAL_MS = 80;

function evaluate(gates, inputs) {
  const nodes = [...inputs];
  for (const gate of gates) {
    const operation = OPERATIONS[gate.op];
    nodes.push(operation(nodes[gate.a], gate.b === undefined ? undefined : nodes[gate.b]));
  }
  return nodes;
}

function buildStage(stageIndex, wrong = 0) {
  const blueprint = STAGES[stageIndex];
  return {
    ...blueprint,
    gates: blueprint.gates.map((gate) => ({ ...gate })),
    outputs: blueprint.outputs.map((output) => ({ ...output })),
    switches: Array(blueprint.switchCount).fill(false),
    wrong,
    lockedUntil: 0,
    lastFeedback: null,
  };
}

export function createCircuitGame(seed) {
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new TypeError('Circuit seed must be a non-empty string');
  }
  return {
    stageIndex: 0,
    stage: buildStage(0),
    points: 0,
    stageStartedAt: 0,
    done: false,
    log: [],
  };
}

export function getCircuitPublicState(game, elapsedMs = 0) {
  if (game.done) {
    return { done: true, points: game.points, stages: STAGES.length };
  }
  return {
    done: false,
    stage: game.stageIndex + 1,
    stages: STAGES.length,
    title: game.stage.title,
    switches: [...game.stage.switches],
    gates: game.stage.gates.map((gate) => ({ ...gate })),
    outputs: game.stage.outputs.map((output) => ({ ...output })),
    target: game.stage.outputs.map((output) => output.target),
    switchCount: game.stage.switchCount,
    wrong: game.stage.wrong,
    maxWrong: CIRCUIT_MAX_WRONG,
    lockedMs: Math.max(0, game.stage.lockedUntil - elapsedMs),
    lastFeedback: game.stage.lastFeedback ? { ...game.stage.lastFeedback } : null,
  };
}

export function applyCircuitInput(game, input) {
  if (game.done) throw new Error('Input received after circuit completion');
  const { stage } = game;
  if (input.type === 'toggle') {
    if (!Number.isInteger(input.idx) || input.idx < 0 || input.idx >= stage.switchCount) {
      throw new Error('Invalid switch');
    }
    stage.switches[input.idx] = !stage.switches[input.idx];
    return;
  }
  if (input.type !== 'submit') throw new Error('Unknown circuit input');
  if (input.timestamp < stage.lockedUntil) throw new Error('Circuit submitted during lockout');

  const nodes = evaluate(stage.gates, stage.switches);
  const correct = stage.outputs.filter((output) => nodes[output.node] === output.target).length;
  if (correct === stage.outputs.length) {
    const seconds = Math.max(0, (input.timestamp - game.stageStartedAt) / 1000);
    const bonus = Math.max(0, Math.round(30 - seconds / 2));
    const gained = Math.max(20, Math.min(100, 70 + bonus - 15 * stage.wrong));
    game.points = Math.min(500, game.points + gained);
    game.log.push({ stage: game.stageIndex + 1, gained, wrong: stage.wrong });
    game.stageIndex += 1;
    if (game.stageIndex >= STAGES.length) {
      game.done = true;
      return;
    }
    game.stage = buildStage(game.stageIndex);
    game.stageStartedAt = input.timestamp;
    return;
  }

  stage.wrong += 1;
  stage.lockedUntil = input.timestamp + CIRCUIT_LOCK_MS;
  stage.lastFeedback = { correct, of: stage.outputs.length };
  if (stage.wrong >= CIRCUIT_MAX_WRONG) {
    game.stage = buildStage(game.stageIndex, CIRCUIT_MAX_WRONG);
    game.stage.lockedUntil = input.timestamp + CIRCUIT_LOCK_MS;
  }
}

export function replayCircuit(seed, inputs, elapsedMs = Number.POSITIVE_INFINITY) {
  if (!Array.isArray(inputs)) throw new Error('Circuit inputs must be an array');
  const game = createCircuitGame(seed);
  let previousTimestamp = -CIRCUIT_MIN_INPUT_INTERVAL_MS;
  for (const input of inputs) {
    if (
      !input
      || !Number.isInteger(input.timestamp)
      || input.timestamp < 0
      || input.timestamp > elapsedMs
      || input.timestamp - previousTimestamp < CIRCUIT_MIN_INPUT_INTERVAL_MS
    ) {
      throw new Error('Invalid circuit input timestamp or rate');
    }
    previousTimestamp = input.timestamp;
    applyCircuitInput(game, input);
  }
  return game;
}
