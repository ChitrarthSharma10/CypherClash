import { replayCircuit } from '../../../shared/circuit.js';

export function validate(seed, inputs, elapsedMs) {
  try {
    const game = replayCircuit(seed, inputs, elapsedMs);
    if (!game.done) return { ok: false, reason: 'circuit incomplete' };
    return { ok: true, points: game.points };
  } catch (error) {
    return { ok: false, reason: error.message || 'invalid circuit input' };
  }
}
