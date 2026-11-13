import { MAX_FILE_BYTES } from '../domain/models';
import type { Backup, Library } from '../domain/models';
import { createBackup } from '../domain/prompts';
import { parseBackup } from '../domain/validation';

export async function readBackup(file: File): Promise<Backup> {
  if (file.size > MAX_FILE_BYTES)
    throw new Error('The backup must be 8 MB or smaller.');
  return parseBackup(await file.text());
}

export function downloadBackup(library: Library): void {
  // Compact JSON keeps every allowed library within the import file size limit.
  const backup = createBackup(library);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `prompt-library-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
