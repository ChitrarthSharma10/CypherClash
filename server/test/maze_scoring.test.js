import test from 'node:test';
import assert from 'node:assert/strict';
import { MazeGameEngine } from '../src/games/maze_engine/gameEngine.js';
import { MAZE_LAYOUTS, GAME_CONFIG } from '../src/games/maze_engine/config.js';

class DummyRepo {
  logEvent() {}
  saveProgress() {}
  saveResult() {}
}

test('flawless run on maze-alpha scores exactly 500 points', () => {
  const engine = new MazeGameEngine(
    { sessionId: 'test-alpha', teamId: 'T1', mazeId: 'maze-alpha' },
    new DummyRepo()
  );
  engine.startGame();

  // Collect all items
  for (const c of engine.collectibles) {
    c.collected = true;
    engine.score += c.points;
  }
  // Clear all checkpoints
  for (const cp of engine.checkpoints) {
    cp.passed = true;
    engine.score += cp.points;
  }
  // Open and award all switches
  for (const sw of engine.switches) {
    sw.active = true;
    sw.awarded = true;
    engine.score += sw.points;
  }

  // Fast finish under par
  engine.timeElapsedMs = (engine.parTimeSec - 5) * 1000;
  engine.endGame(true, 'EXIT_REACHED');

  assert.equal(engine.score, 500, 'Flawless run on maze-alpha must score exactly 500');
});

test('flawless run on maze-beta scores exactly 500 points (layout-independent budget)', () => {
  const engine = new MazeGameEngine(
    { sessionId: 'test-beta', teamId: 'T1', mazeId: 'maze-beta' },
    new DummyRepo()
  );
  engine.startGame();

  // Collect all items
  for (const c of engine.collectibles) {
    c.collected = true;
    engine.score += c.points;
  }
  // Clear all checkpoints
  for (const cp of engine.checkpoints) {
    cp.passed = true;
    engine.score += cp.points;
  }
  // Open and award all switches
  for (const sw of engine.switches) {
    sw.active = true;
    sw.awarded = true;
    engine.score += sw.points;
  }

  // Fast finish under par
  engine.timeElapsedMs = (engine.parTimeSec - 5) * 1000;
  engine.endGame(true, 'EXIT_REACHED');

  assert.equal(engine.score, 500, 'Flawless run on maze-beta must score exactly 500');
});

test('speed bonus decays smoothly to 0 at 3x par time', () => {
  const engine = new MazeGameEngine(
    { sessionId: 'test-speed', teamId: 'T1', mazeId: 'maze-alpha' },
    new DummyRepo()
  );
  engine.startGame();

  // Finish at 3x par time
  engine.timeElapsedMs = (engine.parTimeSec * 3 + 10) * 1000;
  engine.endGame(true, 'EXIT_REACHED');

  // Should have completion bonus (140) + 0 speed bonus
  assert.equal(engine.score, 140);
});

test('respawn after hunter catch keeps previously earned points and prevents double-awarding', () => {
  const engine = new MazeGameEngine(
    { sessionId: 'test-respawn', teamId: 'T1', mazeId: 'maze-alpha' },
    new DummyRepo()
  );
  engine.startGame();

  // Collect 2 collectibles
  const c0 = engine.collectibles[0];
  const c1 = engine.collectibles[1];
  c0.collected = true;
  c1.collected = true;
  engine.score += c0.points + c1.points;
  const scoreBeforeCatch = engine.score;

  // Caught by hunter
  engine.handleHunterCatch(Date.now());

  // Deducted 50 pts, but floored at 0
  assert.equal(engine.score, Math.max(0, scoreBeforeCatch - 50));
  // Collectibles remain collected
  assert.equal(c0.collected, true);
  assert.equal(c1.collected, true);

  // Re-triggering switch does not award points twice
  const sw0 = engine.switches[0];
  sw0.awarded = true;
  const scoreBeforeSwitch = engine.score;
  // Trigger switch in checkTriggers
  engine.character.x = sw0.x;
  engine.character.y = sw0.y;
  engine.checkTriggers(Date.now());

  assert.equal(engine.score, scoreBeforeSwitch, 'Previously awarded switch must not give points a second time');
  engine.stopTickLoop();
});
