/**
 * Configuration for Round 1 Mini-Game 2: Cyber Runner (Subway Surfers Co-op)
 */
export const GAME_CONFIG = {
  GAME_ID: 'cyber-runner',
  ROUND_ID: 'round-1',
  ROUND_NAME: 'Round 1 · Mini-Game 2 (Cyber Runner)',
  
  // Timing (Stopwatch / Elapsed Time mode - no timeout expiration)
  TICK_RATE_HZ: 20,           // 20 ticks per second (50ms interval)
  START_COUNTDOWN_SEC: 3,

  // Track & Lane Specs
  TOTAL_LANES: 3,             // -1: Left, 0: Center, 1: Right
  LANE_POSITIONS: [-1, 0, 1],
  COURSE_LENGTH_METERS: 3000, // Total distance to 3D Finish Line
  CHECKPOINT_INTERVAL_METERS: 375, // 8 Checkpoints every 375m (3000m total)
  
  // Jump & Slide Physics
  JUMP_DURATION_SEC: 0.75,
  JUMP_MAX_HEIGHT: 2.2,
  SLIDE_DURATION_SEC: 1.0,

  // Runner Speeds (meters / second) - Tuned for comfortably doable co-op run
  BASE_SPEED: 12.25,               // Tunable base speed constant (lowered by ~30%)
  SPEED_ACCELERATION: 0.035,
  MAX_SPEED: 16.0,
  COLLISION_RECOVERY_TIME_SEC: 3.0, // Massive slowdown for 3 seconds on collision
  COLLISION_SLOWDOWN_FACTOR: 0.25,  // Slow to 25% of normal speed on collision

  // Scoring (Points divided according to time taken, capped at 500 total)
  SCORING: {
    POINTS_PER_METER: 0.02,      // +1 pt per 50 meters
    GOLD_BAR_VALUE: 5,           // Stolen Gold Bar pickup (+5 pts, or +10 pts with 2X)
    VAULT_VALUE: 20,             // Stolen Vault chest pickup
    CHECKPOINT_BONUS: 15,        // Synchronized checkpoint pass (8 checkpoints = 120 pts)
    AGILITY_BONUS: 5,            // Successfully jumping hurdle or sliding under sign
    BASE_COMPLETION_BONUS: 120,  // Crossing the Finish Line
    TIME_POINTS_DIVIDEND: 25000, // Points divided by finish time: 25000 / finishTimeSec (~125 pts)
    COLLISION_PENALTY: 20,       // Collision stumble penalty
  },

  // Talking Tom Gold Run Power-Ups
  POWER_UPS: {
    MAGNET_DURATION_SEC: 8.0,      // Attracts nearby gold bars
    DOUBLE_GOLD_DURATION_SEC: 8.0, // 2X points on all collected gold
    SHIELD_DURATION_SEC: 10.0,     // Absorbs 1 crash without penalty
  },

  // Authoritative Control Rules:
  // Player 1 controls VERTICAL (Up = Jump, Down = Slide)
  // Player 2 controls HORIZONTAL (Left / Right)
  ROLES: {
    P1: {
      id: 'P1',
      title: 'Player 1 (Vertical)',
      axis: 'VERTICAL',
      allowedActions: ['JUMP', 'SLIDE'],
      allowedKeys: ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'w', 's'],
    },
    P2: {
      id: 'P2',
      title: 'Player 2 (Horizontal)',
      axis: 'HORIZONTAL',
      allowedActions: ['LEFT', 'RIGHT'],
      allowedKeys: ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'a', 'd'],
    },
  },
};
