/**
 * Configuration & Maze Layouts for Game 1: Dual-Control Maze
 * Harder Difficulty: Faster movement speed, shorter barrier durations,
 * additional firewall laser barriers, and pulsating EMP hazard nodes!
 */

export const GAME_CONFIG = {
  GAME_ID: 'treasure-hunt',
  MAX_GAME_SCORE: 500,             // Hard cap: flawless run scores at most 500
  TICK_RATE_HZ: 20,                // 20 updates per second (50ms interval)
  SPEED: 2.2,                      // Deliberate explorer speed: 132+ step 4-door maze lasts 3-4 min
  HUNTER_SPEED_MULTIPLIER: 0.85,   // Hunter speed = 0.85x player speed so pursuit is thrilling but maze is doable
  HUNTER_START_DISTANCE: 3,        // Hunter starts 3 maze cells behind the player, activating chase immediately once player moves into corridor
  CHARACTER_RADIUS: 0.35,          // Collision radius (cell is 1.0 x 1.0) ensures clean buffer to walls
  COLLISION_COOLDOWN_MS: 800,      // Minimum time between collision penalties
  BARRIER_OPEN_DURATION_MS: 4800,  // Co-op window
  HAZARD_PENALTY: 30,              // EMP shockwave point deduction

  // Category Pools totaling 500 max for a flawless run:
  // Collectibles: 140, Checkpoints: 60, Switches: 60, Completion: 140, Speed bonus: 100
  POOLS: {
    COLLECTIBLES: 140,
    CHECKPOINTS: 60,
    SWITCHES: 60,
    COMPLETION: 140,
    SPEED_BONUS: 100,
  },
  SCORING: {
    COMPLETION_BONUS: 140,             // Ancient treasure vault escape bonus
    MAX_SPEED_BONUS: 100,              // Max speed bonus up to 100 pts
    COLLISION_SCORE_PENALTY: 0,        // 0 penalty: wall collision does NOT reduce points
    HUNTER_CATCH_PENALTY: 50,          // -50 pts penalty deduction when caught by hunter
    PIT_FALL_PENALTY: 30,              // -30 pts penalty deduction when falling in pit trap
    EMP_HAZARD_PENALTY: 30,            // -30 pts penalty deduction when hitting EMP hazard
  },
};

/**
 * 0 = Open Path
 * 1 = Wall
 */
export const MAZE_LAYOUTS = [
  {
    id: 'maze-alpha',
    name: 'Sector Alpha - Grand Labyrinth (Epic 4-Door Expedition)',
    width: 31,
    height: 17,
    start: { x: 1.5, y: 1.5 },
    exit: { x: 28.5, y: 14.5 },
    // 31x17 wide epic grid: 4 vast sectors separated by 4 Portcullis Gates requiring 4 Rune Portals
    // Final exit sits cleanly in a 3x3 open chamber (cols 27..29, rows 13..15) with zero wall contact!
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
    checkpoints: [
      { id: 'cp1', x: 5.5, y: 5.5, name: 'Waystone Alpha' },
      { id: 'cp2', x: 9.5, y: 9.5, name: 'Ancient Obelisk' },
      { id: 'cp3', x: 17.5, y: 5.5, name: 'Sun Shrine' },
      { id: 'cp4', x: 25.5, y: 5.5, name: 'Celestial Monolith' },
    ],
    collectibles: [
      { id: 'c1', x: 3.5, y: 1.5, type: 'RUBY', name: 'Crimson Ruby' },
      { id: 'c2', x: 1.5, y: 7.5, type: 'SAPPHIRE', name: 'Royal Sapphire' },
      { id: 'c3', x: 3.5, y: 15.5, type: 'COIN', name: 'Golden Sun Coin' },
      { id: 'c4', x: 9.5, y: 5.5, type: 'RUBY', name: 'Crimson Ruby' },
      { id: 'c5', x: 11.5, y: 1.5, type: 'SAPPHIRE', name: 'Royal Sapphire' },
      { id: 'c6', x: 11.5, y: 15.5, type: 'COIN', name: 'Golden Sun Coin' },
      { id: 'c7', x: 17.5, y: 9.5, type: 'RUBY', name: 'Crimson Ruby' },
      { id: 'c8', x: 19.5, y: 1.5, type: 'SAPPHIRE', name: 'Royal Sapphire' },
      { id: 'c9', x: 19.5, y: 15.5, type: 'COIN', name: 'Golden Sun Coin' },
      { id: 'c10', x: 21.5, y: 9.5, type: 'RUBY', name: 'Crimson Ruby' },
      { id: 'c11', x: 27.5, y: 1.5, type: 'RUBY', name: 'Crimson Ruby' },
      { id: 'c12', x: 29.5, y: 5.5, type: 'SAPPHIRE', name: 'Royal Sapphire' },
      { id: 'c13', x: 27.5, y: 9.5, type: 'COIN', name: 'Golden Sun Coin' },
      { id: 'c14', x: 27.5, y: 14.5, type: 'COIN', name: 'Vault Relic' },
    ],
    switches: [
      { id: 'sw1', x: 1.5, y: 15.5, targetBarrierId: 'bar1', label: 'Sun Rune Portal 1' },
      { id: 'sw2', x: 9.5, y: 1.5, targetBarrierId: 'bar2', label: 'Moon Rune Portal 2' },
      { id: 'sw3', x: 17.5, y: 15.5, targetBarrierId: 'bar3', label: 'Star Rune Portal 3' },
      { id: 'sw4', x: 25.5, y: 1.5, targetBarrierId: 'bar4', label: 'Cosmic Rune Portal 4' },
    ],
    barriers: [
      { id: 'bar1', x: 7, y: 7, orientation: 'HORIZONTAL', label: 'Temple Portcullis A' },
      { id: 'bar2', x: 15, y: 7, orientation: 'HORIZONTAL', label: 'Catacomb Portcullis B' },
      { id: 'bar3', x: 23, y: 7, orientation: 'HORIZONTAL', label: 'Sanctum Portcullis C' },
      { id: 'bar4', x: 27, y: 13, orientation: 'HORIZONTAL', label: 'Vault Portcullis D' },
    ],
    hazards: [
      { id: 'pit1', x: 2.5, y: 3.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Alpha' },
      { id: 'pit2', x: 2.5, y: 11.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Beta' },
      { id: 'pit3', x: 3.5, y: 13.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Gamma' },
      { id: 'pit4', x: 11.5, y: 11.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Delta' },
      { id: 'pit5', x: 11.5, y: 3.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Epsilon' },
      { id: 'pit6', x: 19.5, y: 9.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Zeta' },
      { id: 'pit7', x: 19.5, y: 13.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Eta' },
      { id: 'pit8', x: 27.5, y: 5.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Theta' },
      { id: 'pit9', x: 27.5, y: 11.5, radius: 0.42, type: 'DIG_PIT', label: 'Spike Pit Iota' },
    ],
  },
  {
    id: 'maze-beta',
    name: 'Sector Beta - The Crossfire Grid (Hardened)',
    width: 17,
    height: 13,
    start: { x: 1.5, y: 1.5 },
    exit: { x: 15.5, y: 11.5 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
      [1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
    checkpoints: [
      { id: 'cp1', x: 7.5, y: 5.5, name: 'Nexus 1' },
      { id: 'cp2', x: 13.5, y: 5.5, name: 'Nexus 2' },
    ],
    collectibles: [
      { id: 'c1', x: 3.5, y: 3.5 },
      { id: 'c2', x: 9.5, y: 1.5 },
      { id: 'c3', x: 1.5, y: 7.5 },
      { id: 'c4', x: 7.5, y: 9.5 },
      { id: 'c5', x: 15.5, y: 3.5 },
      { id: 'c6', x: 11.5, y: 11.5 },
    ],
    switches: [
      { id: 'sw1', x: 1.5, y: 11.5, targetBarrierId: 'bar1', label: 'Circuit Bypass 1' },
      { id: 'sw2', x: 5.5, y: 3.5, targetBarrierId: 'bar2', label: 'Circuit Bypass 2' },
    ],
    barriers: [
      { id: 'bar1', x: 11, y: 6, label: 'Isolation Grid A' },
      { id: 'bar2', x: 7, y: 2, label: 'Isolation Grid B' },
    ],
    hazards: [
      { id: 'hz1', x: 5.5, y: 5.5, radius: 0.38, label: 'EMP Pulse A' },
      { id: 'hz2', x: 9.5, y: 5.5, radius: 0.38, label: 'EMP Pulse B' },
      { id: 'hz3', x: 3.5, y: 9.5, radius: 0.38, label: 'EMP Pulse C' },
    ],
  },
];
