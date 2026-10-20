export const TOTAL_ROUNDS = 3;
export const ROUND_NUMBERS = Object.freeze([1, 2, 3]);

export const ROUND_GAMES = Object.freeze({
  1: Object.freeze(['circuit', 'maze', 'runner']),
  2: Object.freeze(['hiddenclue', 'investigation']),
  3: Object.freeze(['investigation', 'round3']),
});

export const ROUND_METADATA = Object.freeze({
  1: Object.freeze({
    round: 1,
    title: 'Mini Games',
    subtitle: 'Circuit Sync, Dual-Control Maze, Cyber Runner',
    displayName: 'Round 01 - Mini Games (Circuit Sync, Dual-Control Maze, Cyber Runner)',
    adminName: 'Mini Games (Circuit Sync, Dual-Control Maze, Cyber Runner)',
    games: Object.freeze(['circuit', 'maze', 'runner']),
    defaultDurationSec: 1800,
  }),
  2: Object.freeze({
    round: 2,
    title: 'Web UI Hijacking',
    subtitle: 'Operation Shadow Beacon',
    displayName: 'Round 02 - Web UI Hijacking (Operation Shadow Beacon)',
    adminName: 'Web UI Hijacking (Operation Shadow Beacon)',
    games: Object.freeze(['hiddenclue', 'investigation']),
    defaultDurationSec: 2700,
  }),
  3: Object.freeze({
    round: 3,
    title: 'Digital Detective',
    subtitle: 'Cyber Incident Investigation',
    displayName: 'Round 03 - Digital Detective (Cyber Incident Investigation)',
    adminName: 'Digital Detective (Cyber Incident Investigation)',
    games: Object.freeze(['investigation', 'round3']),
    defaultDurationSec: 2700,
  }),
});

export function isGameAllowedInRound(game, round) {
  const allowed = ROUND_GAMES[round];
  return Boolean(allowed && allowed.includes(game));
}
