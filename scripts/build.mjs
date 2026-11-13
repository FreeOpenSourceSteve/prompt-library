import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { browserTargets, parseTarget } from '../config/targets.ts';

const requested = process.argv.slice(2);
const targets = requested.length ? requested.map(parseTarget) : browserTargets;
execFileSync(
  process.execPath,
  [
    fileURLToPath(
      new URL('../node_modules/typescript/bin/tsc', import.meta.url),
    ),
    '--noEmit',
  ],
  { stdio: 'inherit' },
);
await import('./generate-notices.mjs');
for (const target of targets) {
  await build({ mode: target });
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('./verify-build.mjs', import.meta.url)), target],
    { stdio: 'inherit' },
  );
}
