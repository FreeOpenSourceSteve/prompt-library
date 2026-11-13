// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { archiveDirectory } from '../../scripts/archive';

it('creates repeatable ZIPs with root manifests and portable entry paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'prompt-archive-'));
  try {
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'manifest.json'), '{"manifest_version":3}');
    await writeFile(join(directory, 'assets', 'sample.js'), 'const plain = true;');
    const archive = await archiveDirectory(directory);
    expect(await archiveDirectory(directory)).toEqual(archive);
    const files = unzipSync(archive);
    expect(Object.keys(files)).toEqual(['assets/sample.js', 'manifest.json']);
    expect(strFromU8(files['assets/sample.js']!)).toBe('const plain = true;');
    expect(Object.keys(files).every((name) => !name.includes('\\'))).toBe(true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
