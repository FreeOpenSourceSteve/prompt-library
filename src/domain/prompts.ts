import type { Backup, Library, Prompt, SortOrder } from './models';
import { SCHEMA_VERSION } from './models';

export function selectPrompts(
  prompts: Prompt[],
  query: string,
  tag: string | null,
  sort: SortOrder,
): Prompt[] {
  const search = query.trim().toLowerCase();
  return prompts
    .filter(
      (prompt) =>
        (!tag || prompt.tags.includes(tag)) &&
        (!search ||
          [prompt.title, prompt.content, ...prompt.tags].some((text) =>
            text.toLowerCase().includes(search),
          )),
    )
    .sort((a, b) => {
      if (sort === 'title')
        return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
      const delta =
        sort === 'oldest'
          ? a.createdAt.localeCompare(b.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt);
      return delta || a.title.localeCompare(b.title);
    });
}

export function getTags(prompts: Prompt[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const prompt of prompts)
    for (const tag of prompt.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createBackup(library: Library, now = new Date()): Backup {
  return {
    format: 'prompt-library',
    version: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    prompts: library.prompts,
    ...(library.speedCopy ? { speedCopy: library.speedCopy } : {}),
  };
}
