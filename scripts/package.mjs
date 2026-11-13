import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  browserTargets,
  parseTarget,
  targetConfig,
} from '../config/targets.ts';
import { archiveDirectory } from './archive.ts';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const requested = process.argv.slice(2);
const targets = requested.length ? requested.map(parseTarget) : browserTargets;
await mkdir('release', { recursive: true });
// Retire the old Chrome-only filename so it cannot be mistaken for a current build.
await rm(resolve(`release/prompt-library-${version}.zip`), { force: true });
for (const target of targets) {
  const destination = resolve(
    `release/prompt-library-${target}-${version}.zip`,
  );
  await writeFile(
    destination,
    await archiveDirectory(resolve(targetConfig(target).outDir)),
  );
  console.log(`Packaged ${destination}`);
}
