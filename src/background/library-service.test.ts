import { describe, expect, it, vi } from 'vitest';
import { backup, library, prompt } from '../../tests/fixtures';
import type { Library } from '../domain/models';
import { MAX_PROMPTS } from '../domain/models';
import { LibraryService } from './library-service';

function setup(initial: unknown = undefined) {
  let stored = structuredClone(initial);
  const storage = {
    read: vi.fn(async () => structuredClone(stored) as unknown),
    write: vi.fn(async (value: Library) => {
      stored = structuredClone(value);
    }),
  };
  return {
    service: new LibraryService(storage),
    storage,
    value: () => structuredClone(stored) as Library,
  };
}

const input = {
  title: 'New prompt',
  content: '  Plain text\n# literal  ',
  tags: ['Work'],
};

describe('durable library operations', () => {
  it('repairs missing and stray legacy markers once without changing prompt metadata or other tags', async () => {
    const first = prompt();
    const second = prompt({
      id: crypto.randomUUID(),
      tags: ['before', '!', 'after'],
    });
    const { service, value, storage } = setup({
      ...library([first, second]),
      speedCopy: [first.id, null, null],
    });
    const expected = {
      ...library([
        { ...first, tags: [...first.tags, '!'] },
        { ...second, tags: ['before', 'after'] },
      ]),
      speedCopy: [first.id, null, null],
    };
    expect(await service.execute({ type: 'library:list' })).toEqual({
      ok: true,
      library: expected,
    });
    expect(value()).toEqual(expected);
    expect(storage.write).toHaveBeenCalledOnce();
    await service.execute({ type: 'library:list' });
    expect(storage.write).toHaveBeenCalledOnce();
  });

  it('rejects manual marker creation and edits at the command boundary', async () => {
    const { service, storage, value } = setup(library());
    for (const tags of [['!'], ['work', ' ! ']]) {
      for (const speedCopy of [undefined, 1]) {
        const manual = { ...input, tags };
        expect(
          await service.execute({
            type: 'prompt:create',
            input: manual,
            speedCopy,
          }),
        ).toMatchObject({
          ok: false,
          error: expect.stringContaining('reserved'),
        });
        expect(
          await service.execute({
            type: 'prompt:update',
            id: prompt().id,
            revision: 1,
            input: manual,
            speedCopy,
          }),
        ).toMatchObject({
          ok: false,
          error: expect.stringContaining('reserved'),
        });
      }
    }
    expect(value()).toEqual(library());
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('duplicates ordinary tags without giving an unassigned copy the marker', async () => {
    const original = prompt({ tags: ['work', '!', 'writing'] });
    const { service, value } = setup({
      ...library([original]),
      speedCopy: [original.id, null, null],
    });
    expect(
      await service.execute({ type: 'prompt:duplicate', id: original.id }),
    ).toMatchObject({ ok: true });
    expect(value().prompts[0]).toEqual(original);
    expect(value().prompts[1]?.tags).toEqual(['work', 'writing']);
    expect(value().speedCopy).toEqual([original.id, null, null]);
  });

  it('restores an imported assignment without a marker and removes markers from unassigned imports', async () => {
    const first = prompt();
    const stray = prompt({ id: crypto.randomUUID(), tags: ['!', 'work'] });
    const { service, value } = setup();
    expect(
      await service.execute({
        type: 'library:import',
        backup: {
          ...backup([first, stray]),
          speedCopy: [first.id, null, null],
        },
      }),
    ).toMatchObject({ ok: true });
    expect(value()).toEqual({
      ...library([
        { ...first, tags: [...first.tags, '!'] },
        { ...stray, tags: ['work'] },
      ]),
      speedCopy: [first.id, null, null],
    });
  });
  it('rejects stale assignment drafts even though assignment-only saves preserve revisions', async () => {
    const { service, value } = setup(library());
    const command = {
      type: 'prompt:update',
      id: prompt().id,
      revision: 1,
      input: prompt(),
      expectedSpeedCopy: null,
    };
    expect(await service.execute({ ...command, speedCopy: 1 })).toMatchObject({
      ok: true,
    });
    const assigned = value();
    expect(
      await service.execute({
        ...command,
        input: { ...prompt(), title: 'Stale draft' },
      }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('another tab'),
    });
    expect(value()).toEqual(assigned);
    expect(
      await service.execute({
        ...command,
        expectedSpeedCopy: 1,
        speedCopy: null,
      }),
    ).toMatchObject({ ok: true });
    expect(value().prompts[0]).toEqual(prompt());
  });
  it('assigns, moves, replaces, and unassigns with only the ! tag changing', async () => {
    const first = prompt();
    const second = prompt({
      id: crypto.randomUUID(),
      title: 'Second',
      tags: ['two', 'other'],
    });
    const { service, value } = setup(library([first, second]));
    const save = (item: typeof first, speedCopy: number | null) =>
      service.execute({
        type: 'prompt:update',
        id: item.id,
        revision: item.revision,
        input: item,
        speedCopy,
      });
    expect(await save(first, 1)).toMatchObject({ ok: true });
    expect(value().speedCopy).toEqual([first.id, null, null]);
    expect(value().prompts).toEqual([
      { ...first, tags: [...first.tags, '!'] },
      second,
    ]);
    await save(first, 3);
    expect(value().speedCopy).toEqual([null, null, first.id]);
    expect(value().prompts[0]).toEqual({
      ...first,
      tags: [...first.tags, '!'],
    });
    await save(second, 3);
    expect(value().speedCopy).toEqual([null, null, second.id]);
    expect(value().prompts).toEqual([
      first,
      { ...second, tags: [...second.tags, '!'] },
    ]);
    await save(second, null);
    expect(value().speedCopy).toEqual([null, null, null]);
    expect(value().prompts).toEqual([first, second]);
  });

  it('keeps 20 existing tags when adding the marker and preserves assignments during edits', async () => {
    const original = prompt({
      tags: Array.from({ length: 20 }, (_, index) => `tag${index}`),
    });
    const { service, value } = setup(library([original]));
    await service.execute({
      type: 'prompt:update',
      id: original.id,
      revision: 1,
      input: original,
      speedCopy: 2,
    });
    expect(value().prompts[0]).toEqual({
      ...original,
      tags: [...original.tags, '!'],
    });
    expect((await service.execute({ type: 'library:list' })).ok).toBe(true);
    await service.execute({
      type: 'prompt:update',
      id: original.id,
      revision: 1,
      input: { ...original, content: 'Changed text' },
    });
    expect(value().prompts[0]).toMatchObject({
      content: 'Changed text',
      revision: 2,
      tags: [...original.tags, '!'],
    });
    expect(value().speedCopy).toEqual([null, original.id, null]);
    await service.execute({
      type: 'prompt:delete',
      id: original.id,
      revision: 2,
    });
    expect(value().speedCopy).toEqual([null, null, null]);
  });

  it('rejects invalid assignments atomically and retains assignments across restarts and backups', async () => {
    const { service, storage, value } = setup(library());
    for (const speedCopy of [0, 4, '1', {}, false]) {
      expect(
        await service.execute({
          type: 'prompt:update',
          id: prompt().id,
          revision: 1,
          input: prompt(),
          speedCopy,
        }),
      ).toMatchObject({ ok: false });
    }
    expect(storage.write).not.toHaveBeenCalled();
    await service.execute({
      type: 'prompt:update',
      id: prompt().id,
      revision: 1,
      input: prompt(),
      speedCopy: 1,
    });
    expect(
      await new LibraryService(storage).execute({ type: 'library:list' }),
    ).toMatchObject({ ok: true, library: value() });
    const restored = setup();
    await restored.service.execute({
      type: 'library:import',
      backup: { ...backup(value().prompts), speedCopy: value().speedCopy },
    });
    expect(restored.value()).toEqual(value());
  });

  it('creates an assigned prompt and imports into free slots without replacing current assignments', async () => {
    const { service, value } = setup();
    await service.execute({ type: 'prompt:create', input, speedCopy: 1 });
    const current = value().prompts[0]!;
    expect(value().speedCopy).toEqual([current.id, null, null]);
    expect(current.tags).toEqual(['work', '!']);
    const imported = prompt({ tags: ['work', '!'] });
    await service.execute({
      type: 'library:import',
      backup: { ...backup([imported]), speedCopy: [imported.id, null, null] },
    });
    expect(value().speedCopy).toEqual([current.id, null, null]);
    expect(value().prompts[1]).toEqual({ ...imported, tags: ['work'] });
  });

  it('serializes concurrent writes and survives a service worker restart', async () => {
    const { service, storage, value } = setup();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        service.execute({ type: 'prompt:create', input }),
      ),
    );
    expect(results.every((result) => result.ok)).toBe(true);
    expect(value().prompts).toHaveLength(8);
    expect(new Set(value().prompts.map((item) => item.id)).size).toBe(8);
    expect(value().prompts[0]?.content).toBe(input.content);
    expect(
      await new LibraryService(storage).execute({ type: 'library:list' }),
    ).toEqual({ ok: true, library: value() });
  });

  it('updates, duplicates, and deletes with durable metadata', async () => {
    const { service, value } = setup(library());
    expect(
      (
        await service.execute({
          type: 'prompt:update',
          id: prompt().id,
          revision: 1,
          input,
        })
      ).ok,
    ).toBe(true);
    expect(value().prompts[0]).toMatchObject({
      ...input,
      tags: ['work'],
      revision: 2,
      createdAt: prompt().createdAt,
    });
    await service.execute({ type: 'prompt:duplicate', id: prompt().id });
    expect(value().prompts[1]).toMatchObject({
      title: 'New prompt (copy)',
      content: input.content,
      revision: 1,
    });
    expect(value().prompts[1]?.id).not.toBe(prompt().id);
    await service.execute({
      type: 'prompt:delete',
      id: prompt().id,
      revision: 2,
    });
    expect(value().prompts).toHaveLength(1);
  });

  it('keeps duplicated titles within the title length limit', async () => {
    const { service, value } = setup(
      library([prompt({ title: 'x'.repeat(160) })]),
    );
    await service.execute({ type: 'prompt:duplicate', id: prompt().id });
    expect(value().prompts[1]?.title).toHaveLength(160);
  });

  it('rejects stale edits and deletes without overwriting newer data', async () => {
    const { service, value } = setup(library());
    await service.execute({
      type: 'prompt:update',
      id: prompt().id,
      revision: 1,
      input,
    });
    for (const type of ['prompt:update', 'prompt:delete']) {
      expect(
        await service.execute({
          type,
          id: prompt().id,
          revision: 1,
          input: { ...input, title: 'Stale' },
        }),
      ).toMatchObject({
        ok: false,
        error: expect.stringContaining('another tab'),
      });
    }
    expect(value().prompts[0]?.title).toBe(input.title);
  });

  it('imports atomically, skips existing IDs, and never overwrites edits', async () => {
    const existing = prompt({ title: 'My recent edit', revision: 2 });
    const additional = prompt({
      id: crypto.randomUUID(),
      title: 'Imported prompt',
    });
    const { service, value } = setup(library([existing]));
    expect(
      await service.execute({
        type: 'library:import',
        backup: backup([prompt(), additional]),
      }),
    ).toMatchObject({ ok: true, imported: 1, skipped: 1 });
    expect(value().prompts).toEqual([existing, additional]);
    expect(
      await service.execute({
        type: 'library:import',
        backup: {
          ...backup(),
          prompts: [prompt(), { ...additional, content: 8 }],
        },
      }),
    ).toMatchObject({ ok: false });
    expect(value().prompts).toEqual([existing, additional]);
  });

  it('rejects unsupported stored versions without modifying them', async () => {
    const { service, storage } = setup({ schemaVersion: 9, prompts: [] });
    expect(
      await service.execute({ type: 'prompt:create', input }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('unsupported'),
    });
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('rejects invalid commands and missing IDs, then continues processing', async () => {
    const { service, storage } = setup(library([]));
    for (const command of [
      null,
      {},
      { type: 'unexpected' },
      { type: 'prompt:create', input: {} },
      { type: 'prompt:duplicate', id: 'invalid' },
      { type: 'prompt:duplicate', id: prompt().id },
      { type: 'library:import', backup: {} },
    ]) {
      expect(await service.execute(command)).toMatchObject({ ok: false });
    }
    expect(storage.write).not.toHaveBeenCalled();
    expect((await service.execute({ type: 'prompt:create', input })).ok).toBe(
      true,
    );
  });

  it('reports storage failures and recovers the queue', async () => {
    const { service, storage, value } = setup(library([]));
    storage.write.mockRejectedValueOnce(new Error('Disk unavailable'));
    expect(await service.execute({ type: 'prompt:create', input })).toEqual({
      ok: false,
      error: 'Disk unavailable',
    });
    expect(value().prompts).toHaveLength(0);
    expect((await service.execute({ type: 'prompt:create', input })).ok).toBe(
      true,
    );
    expect(value().prompts).toHaveLength(1);
  });

  it('enforces count and byte quotas before writing', async () => {
    const full = setup(
      library(
        Array.from({ length: MAX_PROMPTS }, () =>
          prompt({ id: crypto.randomUUID() }),
        ),
      ),
    );
    expect(
      await full.service.execute({ type: 'prompt:create', input }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('2,000') });
    expect(full.storage.write).not.toHaveBeenCalled();
    const large = setup(
      library(
        Array.from({ length: 84 }, () =>
          prompt({ id: crypto.randomUUID(), content: 'x'.repeat(100_000) }),
        ),
      ),
    );
    expect(
      await large.service.execute({ type: 'prompt:create', input }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('8 MB') });
    expect(large.storage.write).not.toHaveBeenCalled();
  });
});
