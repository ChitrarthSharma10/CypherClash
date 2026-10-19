import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCircuitInput,
  createCircuitGame,
  getCircuitPublicState,
} from '../../shared/circuit.js';
import { validate } from '../src/games/circuit.js';

function findSolution(state) {
  for (let mask = 0; mask < 2 ** state.switchCount; mask += 1) {
    const switches = Array.from(
      { length: state.switchCount },
      (_, index) => Boolean(mask & (1 << index)),
    );
    const nodes = [...switches];
    const operations = {
      AND: (first, second) => first && second,
      OR: (first, second) => first || second,
      XOR: (first, second) => first !== second,
      XNOR: (first, second) => first === second,
      NAND: (first, second) => !(first && second),
      NOR: (first, second) => !(first || second),
      NOT: (first) => !first,
    };
    for (const gate of state.gates) {
      nodes.push(operations[gate.op](nodes[gate.a], gate.b === undefined ? undefined : nodes[gate.b]));
    }
    if (state.outputs.every((output) => nodes[output.node] === output.target)) {
      return switches;
    }
  }
  throw new Error('Generated circuit has no solution');
}

function solveSeed(seed) {
  const game = createCircuitGame(seed);
  const inputs = [];
  let timestamp = 0;
  while (!game.done) {
    const state = getCircuitPublicState(game, timestamp);
    const solution = findSolution(state);
    for (let index = 0; index < solution.length; index += 1) {
      if (solution[index] !== state.switches[index]) {
        timestamp += 100;
        const input = { type: 'toggle', idx: index, timestamp };
        inputs.push(input);
        applyCircuitInput(game, input);
      }
    }
    timestamp += 100;
    const input = { type: 'submit', timestamp };
    inputs.push(input);
    applyCircuitInput(game, input);
  }
  return { inputs, points: game.points, timestamp };
}

test('Circuit Sync generation and replay are deterministic for a seed', () => {
  const first = solveSeed('circuit-test-seed');
  const second = solveSeed('circuit-test-seed');
  assert.deepEqual(first, second);
  assert.equal(validate('circuit-test-seed', first.inputs, first.timestamp).ok, true);
});

test('Circuit Sync replay awards points only after all five stages are solved', () => {
  const { inputs, points, timestamp } = solveSeed('complete-circuit-seed');
  const result = validate('complete-circuit-seed', inputs, timestamp);
  assert.deepEqual(result, { ok: true, points });
  assert.ok(points > 0 && points <= 1000);
});

test('the five provided answer keys solve their fixed circuits', () => {
  const answerKeys = [
    [true, false, true],
    [true, true, true, false],
    [true, true, true, false],
    [false, false, false, false, false],
    [true, false, false, true, true, true],
  ];
  const game = createCircuitGame('provided-puzzle-answers');
  let timestamp = 0;

  for (const [stageIndex, answers] of answerKeys.entries()) {
    const state = getCircuitPublicState(game, timestamp);
    assert.equal(state.stage, stageIndex + 1);
    assert.equal(state.switchCount, answers.length);
    for (const [index, shouldBeOn] of answers.entries()) {
      if (shouldBeOn) {
        timestamp += 100;
        applyCircuitInput(game, { type: 'toggle', idx: index, timestamp });
      }
    }
    timestamp += 100;
    applyCircuitInput(game, { type: 'submit', timestamp });
  }

  assert.equal(game.done, true);
});

test('Circuit Sync rejects incomplete, impossible, over-rate, and future inputs', () => {
  const seed = 'invalid-circuit-seed';
  assert.deepEqual(validate(seed, [], 1000), { ok: false, reason: 'circuit incomplete' });
  assert.equal(validate(seed, [{ type: 'toggle', idx: 5, timestamp: 100 }], 100).ok, false);
  assert.equal(validate(seed, [
    { type: 'toggle', idx: 0, timestamp: 100 },
    { type: 'submit', timestamp: 120 },
  ], 1000).ok, false);
  assert.equal(validate(seed, [{ type: 'toggle', idx: 0, timestamp: 101 }], 100).ok, false);
});
