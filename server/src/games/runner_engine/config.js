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
  COURSE_LENGTH_METERS: 4200, // Total distance to 3D Finish Line (~3.5 minute co-op sprint)
  CHECKPOINT_INTERVAL_METERS: 525, // 8 Checkpoints every 525m
  
  // Jump & Slide Physics
  JUMP_DURATION_SEC: 0.75,
  JUMP_MAX_HEIGHT: 2.2,
  SLIDE_DURATION_SEC: 1.0,

  // Runner Speeds (meters / second) - Tuned for continuous 3-4 minute co-op run
  BASE_SPEED: 17.5,
  SPEED_ACCELERATION: 0.035,
  MAX_SPEED: 22.5,
  COLLISION_RECOVERY_TIME_SEC: 1.5,
  COLLISION_SLOWDOWN_FACTOR: 0.45,

  // Scoring (Points divided according to time taken)
  SCORING: {
    POINTS_PER_METER: 0.05,      // +1 pt per 20 meters
    GOLD_BAR_VALUE: 25,          // Stolen Gold Bar pickup (+25 pts, or +50 pts with 2X)
    VAULT_VALUE: 150,            // Stolen Vault chest pickup
    CHECKPOINT_BONUS: 100,       // Synchronized checkpoint pass
    AGILITY_BONUS: 20,           // Successfully jumping hurdle or sliding under sign
    BASE_COMPLETION_BONUS: 2000, // Crossing the Finish Line
    TIME_POINTS_DIVIDEND: 240000,// Points divided by finish time: 240000 / finishTimeSec
    COLLISION_PENALTY: 50,       // Collision stumble penalty
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
