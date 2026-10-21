/**
 * Configuration for Round 1 Mini-Game 2: Cyber Runner (Subway Surfers Co-op)
 */
export const GAME_CONFIG = {
  GAME_ID: 'cyber-runner',
  MAX_GAME_SCORE: 500,        // Hard cap: flawless run scores at most 500
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
  SPEED_SURGE_DISTANCE_METERS: 500, // Speed surge triggered every 500m
  SPEED_SURGE_FACTOR: 0.2,          // Increase speed by 0.2x initial speed every 500m
  SPEED_ACCELERATION: 0.035,
  MAX_SPEED: 26.0,
  COLLISION_RECOVERY_TIME_SEC: 3.0, // Massive slowdown for 3 seconds on collision
  COLLISION_SLOWDOWN_FACTOR: 0.25,  // Slow to 25% of normal speed on collision

  // Budgeted scoring: max 500 total for flawless run
  // (Gold pool ~250 max with 2X + 80 checkpoints + 20 vault + 100 finish + 50 speed bonus = 500)
  // Distance alone yields zero points.
  SCORING: {
    GOLD_POOL: 250,              // Maximum possible gold income pool
    VAULT_VALUE: 20,             // Stolen Vault chest pickup (1 vault = 20 pts)
    CHECKPOINT_BONUS: 10,        // Synchronized checkpoint pass (8 checkpoints = 80 pts)
    BASE_COMPLETION_BONUS: 100,  // Crossing the 3000m Finish Line
    MAX_SPEED_BONUS: 50,         // Speed bonus up to 50 pts based on par time
    COLLISION_PENALTY: 25,       // Collision stumble deduction (-25 pts & 3s slowdown)
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
