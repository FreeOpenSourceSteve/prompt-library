import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import type { Zippable } from 'fflate';

export async function archiveDirectory(directory: string): Promise<Uint8Array> {
  const files: Zippable = {};
  async function collect(path: string, prefix = ''): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const file = join(path, entry.name);
      // ZIP member paths use forward slashes on every operating system.
      const name = prefix + entry.name;
      if (entry.isDirectory()) await collect(file, `${name}/`);
      else if (entry.isFile())
        files[name] = [await readFile(file), { mtime: new Date(2000, 0, 1) }];
      else throw new Error(`Unsupported build entry: ${name}`);
    }
  }
  await collect(directory);
  return zipSync(files, { level: 9 });
}
