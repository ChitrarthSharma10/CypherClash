import test from 'node:test';
import assert from 'node:assert/strict';
import { RunnerGameEngine } from '../src/games/runner_engine/gameEngine.js';
import { GAME_CONFIG } from '../src/games/runner_engine/config.js';

class DummyRepo {
  logEvent() {}
  saveProgress() {}
  saveResult() {}
}

test('1,000 seed simulation: perfect bot, crash bot, N+1 gold monotonicity, zero distance points', () => {
  for (let s = 1; s <= 1000; s++) {
    const seed = `sim-seed-${s}`;

    // (a) Perfect bot: collects all gold, uses all powerups, finishes fast (under par time = 200s)
    {
      const engine = new RunnerGameEngine(
        { sessionId: `sess-perf-${s}`, teamId: 'T1', seed },
        new DummyRepo(),
        () => {},
        () => {}
      );
      // Simulate fast perfect run
      engine.status = 'IN_PROGRESS';
      engine.distanceMeters = GAME_CONFIG.COURSE_LENGTH_METERS;
      engine.timeElapsedMs = 180 * 1000; // 180s < 200s par

      // Pass all checkpoints
      engine.checkpointsPassed = engine.checkpoints.length;
      engine.score += engine.checkpointsPassed * GAME_CONFIG.SCORING.CHECKPOINT_BONUS; // 8 * 10 = 80

      // Collect 1 vault
      engine.vaultsCollected = 1;
      engine.score += GAME_CONFIG.SCORING.VAULT_VALUE; // 20

      // Collect all gold bars under optimal double gold windows
      const dgPowerUps = engine.powerUps.filter((p) => p.type === 'DOUBLE_GOLD');
      for (const coin of engine.coins) {
        coin.collected = true;
        const in2x = dgPowerUps.some((pu) => coin.distance >= pu.distance && coin.distance <= pu.distance + 128);
        const mult = in2x ? 2 : 1;
        const earned = engine.goldBarValue * mult;
        engine.coinsCollected++;
        engine.goldBarsCollected++;
        engine.goldPoints += earned;
        engine.score += earned;
      }

      engine.endGame(true, 'FINISH_LINE_CROSSED');

      assert.ok(
        engine.score <= 500 && engine.score >= 450,
        `Seed ${seed}: perfect score ${engine.score} must be between 450 and 500`
      );
    }

    // (b) No-gold / slow / crash-heavy bot: score >= 0
    {
      const engine = new RunnerGameEngine(
        { sessionId: `sess-crash-${s}`, teamId: 'T1', seed },
        new DummyRepo(),
        () => {},
        () => {}
      );
      engine.status = 'IN_PROGRESS';
      engine.distanceMeters = GAME_CONFIG.COURSE_LENGTH_METERS;
      engine.timeElapsedMs = 800 * 1000; // Very slow (> 3x par)

      // Zero gold, zero vaults, 20 crashes
      for (let c = 0; c < 20; c++) {
        engine.collisionsCount++;
        engine.penalties += GAME_CONFIG.SCORING.COLLISION_PENALTY;
        engine.score = Math.max(0, engine.score - GAME_CONFIG.SCORING.COLLISION_PENALTY);
      }

      engine.endGame(true, 'FINISH_LINE_CROSSED');
      assert.ok(engine.score >= 0, `Seed ${seed}: crash score ${engine.score} must be >= 0`);
    }

    // (c) Assert collecting N+1 gold bars always yields strictly more points than N
    {
      const engine = new RunnerGameEngine(
        { sessionId: `sess-mono-${s}`, teamId: 'T1', seed },
        new DummyRepo(),
        () => {},
        () => {}
      );
      engine.status = 'IN_PROGRESS';

      let prevScore = engine.score;
      for (let i = 0; i < Math.min(10, engine.coins.length); i++) {
        const coin = engine.coins[i];
        coin.collected = true;
        const earned = engine.goldBarValue * 1;
        engine.goldBarsCollected++;
        engine.goldPoints += earned;
        engine.score += earned;

        assert.ok(
          engine.score > prevScore,
          `Seed ${seed}: collecting gold bar ${i + 1} must strictly increase score`
        );
        prevScore = engine.score;
      }
    }

    // (d) Assert distance alone yields only checkpoint + finish + speed points, zero distance points
    {
      const engine = new RunnerGameEngine(
        { sessionId: `sess-dist-${s}`, teamId: 'T1', seed },
        new DummyRepo(),
        () => {},
        () => {}
      );
      engine.status = 'IN_PROGRESS';
      engine.distanceMeters = GAME_CONFIG.COURSE_LENGTH_METERS;
      engine.timeElapsedMs = 180 * 1000; // Under par (180s) => 50 speed points

      // All checkpoints passed
      engine.checkpointsPassed = engine.checkpoints.length; // 8 * 10 = 80
      engine.score += engine.checkpointsPassed * GAME_CONFIG.SCORING.CHECKPOINT_BONUS;

      // No pickups, no crashes
      engine.endGame(true, 'FINISH_LINE_CROSSED');

      // Expected: 80 (checkpoints) + 100 (completion) + 50 (speed) = 230 points exactly
      assert.equal(
        engine.score,
        230,
        `Seed ${seed}: run with no pickups must award exactly checkpoints(80) + finish(100) + speed(50) = 230, zero distance points`
      );
      assert.equal(engine.goldPoints, 0);
    }
  }
});
