import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCircuitInput,
  createCircuitGame,
  getCircuitPublicState,
} from '../shared/circuit.js';
import { buildCircuitSchematic } from './circuitSchematicLayout.js';

test('stage 1-3 schematics have distinct wires, two gate inputs, and fit their viewBox', () => {
  const answers = [
    [true, false, true],
    [true, true, true, false],
    [true, true, true, false],
  ];
  const game = createCircuitGame('schematic-layout-fixture');
  let timestamp = 0;

  for (const [stageIndex, solution] of answers.entries()) {
    const state = getCircuitPublicState(game, timestamp);
    assert.equal(state.stage, stageIndex + 1);
    const layout = buildCircuitSchematic(state);
    const paths = layout.wires.map((wire) => wire.path);
    assert.equal(new Set(paths).size, paths.length, `stage ${state.stage} wire paths must be unique`);

    for (const gate of state.gates) {
      const incoming = layout.wires.filter((wire) => wire.target === `G${state.gates.indexOf(gate) + 1}`);
      assert.equal(incoming.length, 2, `stage ${state.stage} gates must have two input wires`);
    }
    for (const node of layout.nodes) {
      assert.ok(node.x >= layout.viewBox.x, `${node.id} left edge is inside viewBox`);
      assert.ok(node.y >= layout.viewBox.y, `${node.id} top edge is inside viewBox`);
      assert.ok(node.x + node.width <= layout.viewBox.width, `${node.id} right edge is inside viewBox`);
      assert.ok(node.y + node.height <= layout.viewBox.height, `${node.id} bottom edge is inside viewBox`);
    }
    for (const wire of layout.wires) {
      assert.ok(
        wire.sourcePoint.y < wire.targetPoint.y,
        `stage ${state.stage} wire ${wire.id} flows downward`,
      );
    }

    for (const [index, on] of solution.entries()) {
      if (on) {
        timestamp += 100;
        applyCircuitInput(game, { type: 'toggle', idx: index, timestamp });
      }
    }
    timestamp += 100;
    applyCircuitInput(game, { type: 'submit', timestamp });
  }
});

test('stages 4-5 fit a 512px schematic viewport without horizontal scrolling', () => {
  const answers = [
    [true, false, true],
    [true, true, true, false],
    [true, true, true, false],
    [false, false, true, true, false],
    [true, false, true, true, false, false],
  ];
  const game = createCircuitGame('responsive-schematic-fixture');
  let timestamp = 0;

  for (const [stageIndex, solution] of answers.entries()) {
    const state = getCircuitPublicState(game, timestamp);
    assert.equal(state.stage, stageIndex + 1);
    const layout = buildCircuitSchematic(state);
    assert.ok(layout.viewBox.width <= 512, `stage ${state.stage} fits the schematic viewport`);
    assert.ok(layout.viewBox.height > 0, `stage ${state.stage} has a positive layout height`);

    for (const [index, on] of solution.entries()) {
      if (on) {
        timestamp += 100;
        applyCircuitInput(game, { type: 'toggle', idx: index, timestamp });
      }
    }
    timestamp += 100;
    applyCircuitInput(game, { type: 'submit', timestamp });
  }
});
