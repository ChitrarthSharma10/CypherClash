import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('round3_investigation');
const destination = resolve('dist/round3_investigation');

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });