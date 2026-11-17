import type { Backup, Library, Prompt, SortOrder } from './models';
import { SCHEMA_VERSION } from './models';
import { createContentResolver } from './composition';

export function selectPrompts(
  prompts: Prompt[],
  query: string,
  tag: string | null,
  sort: SortOrder,
  resolveContent: (id: string) => string = (id) => {
    const prompt = prompts.find((item) => item.id === id);
    return typeof prompt?.content === 'string' ? prompt.content : '';
  },
): Prompt[] {
  const search = query.trim().toLowerCase();
  return prompts
    .filter(
      (prompt) =>
        (!tag || prompt.tags.includes(tag)) &&
        (!search ||
          [
            prompt.title,
            ...prompt.tags,
            ...(search ? [resolveContent(prompt.id)] : []),
          ].some((text) => text.toLowerCase().includes(search))),
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

export function getTags(
  prompts: Pick<Prompt, 'tags'>[],
): { name: string; count: number }[] {
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
    components: library.components,
    ...(library.speedCopy ? { speedCopy: library.speedCopy } : {}),
  };
}

// Share a resolver across all consumers of the same snapshot without retaining
// old libraries after a storage refresh.
const resolvers = new WeakMap<
  Library,
  ReturnType<typeof createContentResolver>
>();
function libraryResolver(library: Library) {
  let resolver = resolvers.get(library);
  if (!resolver) {
    resolver = createContentResolver(library);
    resolvers.set(library, resolver);
  }
  return resolver;
}
export function libraryContent(library: Library | null) {
  return library ? libraryResolver(library).prompt : () => '';
}
export function libraryPreview(library: Library | null) {
  return library ? libraryResolver(library).preview : () => '';
}
