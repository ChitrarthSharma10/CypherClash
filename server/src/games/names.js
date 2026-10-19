export const GAMES = Object.freeze({
  maze: Object.freeze({ maxDurationSec: 300 }),
  runner: Object.freeze({ maxDurationSec: 120 }),
  circuit: Object.freeze({ maxDurationSec: 300 }),
  investigation: Object.freeze({ maxDurationSec: 600 }),
});

export const GAME_NAMES = Object.freeze(Object.keys(GAMES));
