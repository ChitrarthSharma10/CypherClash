import { validate as validateCircuit } from './circuit.js';
import { validate as validateMaze } from './maze.js';
import { validate as validateRunner } from './runner.js';

// Validators must reject inputs whose timestamps exceed the supplied elapsed time.
export const gameValidators = new Map([
  ['maze', validateMaze],
  ['runner', validateRunner],
  ['circuit', validateCircuit],
]);
