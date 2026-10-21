import test from 'node:test';
import assert from 'node:assert/strict';
import { MazeGameEngine } from '../src/games/maze_engine/gameEngine.js';
import { MAZE_LAYOUTS, GAME_CONFIG } from '../src/games/maze_engine/config.js';
import { getShortestPath } from '../src/games/maze_engine/validateLayout.js';

class DummyRepo {
  logEvent() {}
  saveProgress() {}
  saveResult() {}
}

test('drive character against every wall with several dt values (including 500ms lag spike) -> never inside solid cell', () => {
  const engine = new MazeGameEngine(
    { sessionId: 'test-wall-drive', teamId: 'T1', mazeId: 'maze-alpha' },
    new DummyRepo()
  );
  try {
    engine.startGame();

    const r = GAME_CONFIG.CHARACTER_RADIUS || 0.35;
    const dts = [0.016, 0.05, 0.1, 0.25, 0.5]; // 500ms lag spike included
    const dirs = [
      [1, 0],   // East into wall
      [-1, 0],  // West into wall
      [0, 1],   // South into wall
      [0, -1],  // North into wall
      [1, 1],   // South-East diagonal
      [-1, 1],  // South-West diagonal
      [1, -1],  // North-East diagonal
      [-1, -1], // North-West diagonal
    ];

    for (const dt of dts) {
      for (const [vx, vy] of dirs) {
        engine.character.vx = vx;
        engine.character.vy = vy;

        for (let i = 0; i < 50; i++) {
          const moveX = engine.character.vx * GAME_CONFIG.SPEED * dt;
          const moveY = engine.character.vy * GAME_CONFIG.SPEED * dt;
          engine.moveWithCollision(moveX, moveY, Date.now());

          const cx = engine.character.x;
          const cy = engine.character.y;
          assert.ok(!engine.isCellSolid(Math.floor(cx), Math.floor(cy)), `Character center (${cx}, ${cy}) ended inside solid cell`);
          assert.ok(engine.isCircleValid(cx, cy, r), `Character circle at (${cx}, ${cy}) penetrates a solid wall`);
        }
      }
    }
  } finally {
    engine.stopTickLoop();
  }
});

test('scripted bot following progressive BFS solution reaches exit with hunter active and chasing', () => {
  const engine = new MazeGameEngine(
    { sessionId: 'test-bot-solvability', teamId: 'T1', mazeId: 'maze-beta' },
    new DummyRepo()
  );
  try {
    engine.startGame();

    let reachedExit = false;
    const layout = engine.layout;

    // Sequence for beta: switch 1, switch 2, exit
    const targets = [
      { x: layout.switches[0].x, y: layout.switches[0].y },
      { x: layout.switches[1].x, y: layout.switches[1].y },
      { x: layout.exit.x, y: layout.exit.y, isExit: true },
    ];

    for (const target of targets) {
      let subSteps = 0;
      while (subSteps < 500) {
        subSteps++;
        const charCol = Math.floor(engine.character.x);
        const charRow = Math.floor(engine.character.y);
        const targetCol = Math.floor(target.x);
        const targetRow = Math.floor(target.y);

        if (charCol === targetCol && charRow === targetRow) {
          engine.character.x = target.x;
          engine.character.y = target.y;
          engine.checkTriggers(Date.now());
          if (target.isExit) reachedExit = true;
          break;
        }

        const blocked = new Set();
        for (const b of engine.barriers) {
          if (!b.open) blocked.add(`${b.x},${b.y}`);
        }
        for (const h of layout.hazards || []) {
          blocked.add(`${Math.floor(h.x)},${Math.floor(h.y)}`);
        }
        const path = getShortestPath(layout.grid, layout.width, layout.height, charCol, charRow, targetCol, targetRow, blocked);
        assert.ok(path, `Path must exist to target (${targetCol}, ${targetRow})`);

        const nextCell = path[1] || path[0];
        engine.character.x = nextCell[0] + 0.5;
        engine.character.y = nextCell[1] + 0.5;
        engine.checkTriggers(Date.now());

        // Update hunter (hunter activates when player moves >= 3 cells away)
        engine.updateHunter(0.05, Date.now());

        const hCol = Math.floor(engine.hunter.x);
        const hRow = Math.floor(engine.hunter.y);
        assert.ok(!engine.isCellSolid(hCol, hRow), `Hunter at (${engine.hunter.x}, ${engine.hunter.y}) entered solid cell`);
      }
    }

    assert.ok(reachedExit, 'Scripted bot must reach exit successfully');
  } finally {
    engine.stopTickLoop();
  }
});

test('run hunter for 60 simulated seconds: hunter centre is never inside a solid cell or closed barrier', () => {
  const engine = new MazeGameEngine(
    { sessionId: 'test-hunter-safety', teamId: 'T1', mazeId: 'maze-alpha' },
    new DummyRepo()
  );
  try {
    engine.startGame();
    engine.hunter.active = true;

    // Player stands at checkpoint 1
    engine.character.x = engine.checkpoints[0].x;
    engine.character.y = engine.checkpoints[0].y;

    const dt = 0.05;
    const totalTicks = 60 / dt; // 1200 ticks = 60s
    for (let tick = 0; tick < totalTicks; tick++) {
      engine.updateHunter(dt, Date.now());

      const hCol = Math.floor(engine.hunter.x);
      const hRow = Math.floor(engine.hunter.y);
      assert.ok(
        !engine.isCellSolid(hCol, hRow),
        `Hunter center (${engine.hunter.x}, ${engine.hunter.y}) entered solid cell (${hCol}, ${hRow})`
      );
    }
  } finally {
    engine.stopTickLoop();
  }
});

test('barrier closing while player is inside does not trap or tunnel player', () => {
  const engine = new MazeGameEngine(
    { sessionId: 'test-barrier-safety', teamId: 'T1', mazeId: 'maze-alpha' },
    new DummyRepo()
  );
  try {
    engine.startGame();

    const barrier = engine.barriers[0]; // bar1 at (7, 7)
    barrier.open = true;

    // Place player right in the barrier cell center
    engine.character.x = barrier.x + 0.5;
    engine.character.y = barrier.y + 0.5;

    // Barrier closes
    barrier.open = false;
    engine.resolveBarrierOverlap(barrier);

    const charCol = Math.floor(engine.character.x);
    const charRow = Math.floor(engine.character.y);
    assert.ok(!(charCol === barrier.x && charRow === barrier.y), 'Player must be pushed outside the closed barrier cell');
    assert.ok(!engine.isCellSolid(charCol, charRow), 'Player must be in an open cell, not a wall');
    assert.ok(engine.isCircleValid(engine.character.x, engine.character.y, GAME_CONFIG.CHARACTER_RADIUS), 'Player circle must be valid');
  } finally {
    engine.stopTickLoop();
  }
});
