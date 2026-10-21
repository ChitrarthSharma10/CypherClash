import test from 'node:test';
import assert from 'node:assert/strict';
import { MAZE_LAYOUTS } from '../src/games/maze_engine/config.js';
import { validateLayout } from '../src/games/maze_engine/validateLayout.js';

test('every layout in MAZE_LAYOUTS validates successfully with guaranteed solvability', () => {
  assert.ok(MAZE_LAYOUTS.length >= 2, 'Must have at least 2 maze layouts');
  for (const layout of MAZE_LAYOUTS) {
    const report = validateLayout(layout);
    assert.equal(report.valid, true);
    assert.ok(report.solutionLength > 0);
    assert.ok(report.estimatedSeconds > 0);
    assert.ok(report.hazardFreeSolutionLength > 0);
  }
});

test('validateLayout fails if start cell is inside a wall', () => {
  const badLayout = JSON.parse(JSON.stringify(MAZE_LAYOUTS[0]));
  badLayout.grid[Math.floor(badLayout.start.y)][Math.floor(badLayout.start.x)] = 1;
  assert.throws(() => validateLayout(badLayout), /inside a wall/);
});

test('validateLayout fails if exit cell is inside a wall', () => {
  const badLayout = JSON.parse(JSON.stringify(MAZE_LAYOUTS[0]));
  badLayout.grid[Math.floor(badLayout.exit.y)][Math.floor(badLayout.exit.x)] = 1;
  assert.throws(() => validateLayout(badLayout), /inside a wall/);
});

test('validateLayout fails if a switch room is blocked and unreachable', () => {
  const badLayout = JSON.parse(JSON.stringify(MAZE_LAYOUTS[0]));
  // Wall off switch 1
  const sw = badLayout.switches[0];
  const sx = Math.floor(sw.x);
  const sy = Math.floor(sw.y);
  // Surround with walls
  for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const nx = sx + dx;
    const ny = sy + dy;
    if (nx >= 0 && nx < badLayout.width && ny >= 0 && ny < badLayout.height) {
      badLayout.grid[ny][nx] = 1;
    }
  }
  assert.throws(() => validateLayout(badLayout), /Progressive unlock stalled/);
});

test('validateLayout fails if all paths to exit pass through mandatory hazards', () => {
  const badLayout = JSON.parse(JSON.stringify(MAZE_LAYOUTS[1]));
  // In maze-beta, exit is at (15.5, 11.5). The neighboring cells are (14, 11) and (15, 10).
  badLayout.hazards.push(
    { id: 'blocker-1', x: 14.5, y: 11.5, radius: 0.4, type: 'DIG_PIT' },
    { id: 'blocker-2', x: 15.5, y: 10.5, radius: 0.4, type: 'DIG_PIT' }
  );
  assert.throws(() => validateLayout(badLayout), /Cannot reach exit|no path to exit/);
});
