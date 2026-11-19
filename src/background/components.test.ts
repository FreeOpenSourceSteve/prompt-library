import { describe, expect, it, vi } from 'vitest';
import { backup, component, library, prompt } from '../../tests/fixtures';
import type { Library } from '../domain/models';
import { createBackup, libraryContent } from '../domain/prompts';
import { LibraryService } from './library-service';

function setup(initial: unknown = library([])) {
  let stored: unknown = structuredClone(initial);
  const storage = {
    read: async () => structuredClone(stored),
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

describe('atomic component operations', () => {
  it('saves inline component edits and tags in the same transaction as prompt creation and updates', async () => {
    const role = component();
    const existing = prompt({ content: [{ type: 'component', id: role.id }] });
    const { service, storage, value } = setup({
      ...library([existing]),
      components: [role],
    });
    const input = {
      title: 'New assembly',
      content: [{ type: 'component', id: role.id }],
      tags: [],
    };
    expect(
      await service.execute({
        type: 'prompt:create',
        input,
        componentUpdates: [
          {
            id: role.id,
            revision: 1,
            input: {
              name: role.name,
              content: 'Shared update',
              tags: [' Nursing ', 'NURSING', 'role'],
            },
          },
        ],
      }),
    ).toMatchObject({ ok: true });
    expect(storage.write).toHaveBeenCalledOnce();
    expect(value().components[0]).toMatchObject({
      tags: ['nursing', 'role'],
      content: 'Shared update',
      revision: 2,
    });
    expect(libraryContent(value())(existing.id)).toBe('Shared update');
    expect(value().prompts[0]).toEqual(existing);
    expect(
      await service.execute({
        type: 'prompt:update',
        id: existing.id,
        revision: 1,
        input: { ...existing, title: 'Renamed assembly' },
        componentUpdates: [
          {
            id: role.id,
            revision: 2,
            input: {
              name: role.name,
              content: 'Second update',
              tags: ['teaching'],
            },
          },
        ],
      }),
    ).toMatchObject({ ok: true });
    expect(storage.write).toHaveBeenCalledTimes(2);
    expect(value().prompts[0]).toMatchObject({
      title: 'Renamed assembly',
      revision: 2,
    });
    const destination = setup();
    expect(
      await destination.service.execute({
        type: 'library:import',
        backup: createBackup(value()),
      }),
    ).toMatchObject({ ok: true });
    expect(destination.value()).toEqual(value());
  });

  it('rejects stale, duplicate, invalid, or oversized inline edits without partial writes', async () => {
    const first = component();
    const second = component({ name: 'Task' });
    const saved = prompt({
      content: [
        { type: 'component', id: first.id },
        { type: 'component', id: first.id },
      ],
    });
    const initial = { ...library([saved]), components: [first, second] };
    const { service, storage, value } = setup(initial);
    const edit = {
      id: first.id,
      revision: 1,
      input: { name: first.name, content: 'Unsaved', tags: ['test'] },
    };
    const command = {
      type: 'prompt:update',
      id: saved.id,
      revision: 1,
      input: { ...saved, title: 'Do not save' },
      newComponents: [component({ name: 'Do not create' })],
    };
    for (const componentUpdates of [
      [edit, { ...edit, id: second.id, revision: 2 }],
      [edit, edit],
      [{ ...edit, input: { ...edit.input, tags: ['!'] } }],
      [{ ...edit, input: { ...edit.input, name: second.name } }],
      [{ ...edit, input: { ...edit.input, content: 'x'.repeat(50_000) } }],
      [{ ...edit, id: crypto.randomUUID() }],
    ])
      expect(
        await service.execute({ ...command, componentUpdates }),
      ).toMatchObject({ ok: false });
    expect(storage.write).not.toHaveBeenCalled();
    expect(value()).toEqual(initial);
    storage.write.mockRejectedValueOnce(new Error('Disk unavailable'));
    expect(
      await service.execute({ ...command, componentUpdates: [edit] }),
    ).toMatchObject({ ok: false });
    expect(value()).toEqual(initial);
  });

  it('creates all-new, all-existing, and mixed prompts with full-prompt nesting', async () => {
    const { service, storage, value } = setup();
    const role = component();
    const task = component({
      name: 'Exam task',
      content: 'Task: create an exam',
    });
    const content = [
      { type: 'component', id: role.id },
      { type: 'component', id: task.id },
    ];
    expect(
      await service.execute({
        type: 'prompt:create',
        input: { title: 'Exam', content, tags: [] },
        newComponents: [role, task],
        speedCopy: 1,
      }),
    ).toMatchObject({ ok: true });
    expect(storage.write).toHaveBeenCalledOnce();
    expect(value().components).toHaveLength(2);
    const first = value().prompts[0]!;
    expect(libraryContent(value())(first.id)).toBe(
      'Role: tutor\n\nTask: create an exam',
    );
    expect(
      await service.execute({
        type: 'prompt:create',
        input: { title: 'Existing', content, tags: [] },
      }),
    ).toMatchObject({ ok: true });
    const note = component({
      name: 'Exam note',
      content: 'Include citations.',
    });
    expect(
      await service.execute({
        type: 'prompt:create',
        input: {
          title: 'Mixed',
          content: [
            { type: 'prompt', id: first.id },
            { type: 'component', id: note.id },
          ],
          tags: [],
        },
        newComponents: [note],
      }),
    ).toMatchObject({ ok: true });
    expect(value().components).toHaveLength(3);
    expect(libraryContent(value())(value().prompts[2]!.id)).toBe(
      'Role: tutor\n\nTask: create an exam\n\nInclude citations.',
    );
    const restored = setup();
    expect(
      await restored.service.execute({
        type: 'library:import',
        backup: createBackup(value()),
      }),
    ).toMatchObject({ ok: true, imported: 3, importedComponents: 3 });
    expect(restored.value()).toEqual(value());
  });

  it('applies shared edits live, rejects stale edits, and protects referenced items', async () => {
    const role = component();
    const child = prompt({ content: [{ type: 'component', id: role.id }] });
    const parent = prompt({
      id: crypto.randomUUID(),
      title: 'Parent',
      content: [{ type: 'prompt', id: child.id }],
    });
    const { service, storage, value } = setup({
      ...library([child, parent]),
      components: [role],
    });
    expect(
      await service.execute({
        type: 'component:update',
        id: role.id,
        revision: 1,
        input: { name: 'Updated role', content: 'Updated shared text' },
      }),
    ).toMatchObject({ ok: true });
    expect(libraryContent(value())(parent.id)).toBe('Updated shared text');
    expect(value().components[0]?.revision).toBe(2);
    // Parent metadata represents its own assembly, not a copy of shared text.
    expect(value().prompts).toEqual([child, parent]);
    const saved = value();
    for (const command of [
      { type: 'component:update', id: role.id, revision: 1, input: role },
      { type: 'component:delete', id: role.id, revision: 1 },
      { type: 'component:delete', id: role.id, revision: 2 },
      { type: 'prompt:delete', id: child.id, revision: 1 },
      {
        type: 'prompt:update',
        id: child.id,
        revision: 1,
        input: { ...child, content: [{ type: 'prompt', id: parent.id }] },
      },
    ])
      expect(await service.execute(command)).toMatchObject({ ok: false });
    expect(value()).toEqual(saved);
    expect(storage.write).toHaveBeenCalledOnce();
    await service.execute({
      type: 'prompt:delete',
      id: parent.id,
      revision: 1,
    });
    await service.execute({ type: 'prompt:delete', id: child.id, revision: 1 });
    expect(
      await service.execute({
        type: 'component:delete',
        id: role.id,
        revision: 2,
      }),
    ).toMatchObject({ ok: true });
    expect(value().components).toEqual([]);
  });

  it('rejects conflicting names, IDs, invalid references, and oversized shared edits without writes', async () => {
    const role = component({ name: 'Shared', content: 'x' });
    const composed = prompt({
      content: [
        { type: 'component', id: role.id },
        { type: 'component', id: role.id },
      ],
    });
    const initial = { ...library([composed]), components: [role] };
    const { service, value, storage } = setup(initial);
    for (const command of [
      {
        type: 'component:create',
        input: { name: ' SHARED ', content: 'Conflict' },
      },
      {
        type: 'component:create',
        input: { name: composed.title.toUpperCase(), content: 'Conflict' },
      },
      {
        type: 'component:update',
        id: role.id,
        revision: 1,
        input: { name: 'Shared', content: 'x'.repeat(50_000) },
      },
      {
        type: 'prompt:create',
        input: { title: 'shared', content: 'Conflict', tags: [] },
      },
      {
        type: 'prompt:create',
        input: {
          title: 'New',
          content: [{ type: 'component', id: crypto.randomUUID() }],
          tags: [],
        },
        newComponents: [component({ name: 'Unsaved' })],
      },
      {
        type: 'prompt:create',
        input: { title: 'New', content: 'text', tags: [] },
        newComponents: [role],
      },
      {
        type: 'prompt:update',
        id: composed.id,
        revision: 1,
        input: { ...composed, title: 'SHARED' },
      },
    ])
      expect(await service.execute(command)).toMatchObject({ ok: false });
    expect(storage.write).not.toHaveBeenCalled();
    expect(value()).toEqual(initial);
  });

  it('does not leave orphaned components after a failed write and recovers its queue', async () => {
    const { service, storage, value } = setup();
    const part = component();
    storage.write.mockRejectedValueOnce(new Error('Unavailable'));
    const command = {
      type: 'prompt:create',
      input: {
        title: 'Exam',
        content: [{ type: 'component', id: part.id }],
        tags: [],
      },
      newComponents: [part],
    };
    expect(await service.execute(command)).toMatchObject({ ok: false });
    expect(value()).toEqual(library([]));
    expect(await service.execute(command)).toMatchObject({ ok: true });
    expect(value().components).toHaveLength(1);
  });

  it('merges both entity collections by ID and rejects merged namespace and graph conflicts', async () => {
    const role = component();
    const original = prompt({ content: [{ type: 'component', id: role.id }] });
    const initial = { ...library([original]), components: [role] };
    const { service, value } = setup(initial);
    const incoming = createBackup({
      ...initial,
      components: [{ ...role, content: 'Older' }],
    });
    expect(
      await service.execute({ type: 'library:import', backup: incoming }),
    ).toMatchObject({
      ok: true,
      imported: 0,
      skipped: 1,
      importedComponents: 0,
      skippedComponents: 1,
    });
    expect(value()).toEqual(initial);
    const conflicting = {
      ...backup([]),
      components: [component({ name: original.title })],
    };
    // Valid by itself, but conflicts with a saved prompt title.
    expect(
      await service.execute({ type: 'library:import', backup: conflicting }),
    ).toMatchObject({ ok: false });
    const large = component({ content: 'x'.repeat(50_000) });
    const destination = setup({ ...library([]), components: [large] });
    const incomingPrompt = prompt({
      content: [
        { type: 'component', id: large.id },
        { type: 'component', id: large.id },
      ],
    });
    const validBackup = createBackup({
      ...library([incomingPrompt]),
      components: [{ ...large, content: 'Short backup text' }],
    });
    // The existing component wins by ID, making the merged output too large.
    expect(
      await destination.service.execute({
        type: 'library:import',
        backup: validBackup,
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('100,000') });
    expect(destination.value().prompts).toEqual([]);
    expect(value()).toEqual(initial);
  });

  it('persists version 1 migration once and leaves durable state intact on failure', async () => {
    const old = { schemaVersion: 1, prompts: [prompt()] };
    const { service, storage, value } = setup(old);
    storage.write.mockRejectedValueOnce(new Error('Disk full'));
    expect(await service.execute({ type: 'library:list' })).toMatchObject({
      ok: false,
    });
    expect(value()).toEqual(old);
    expect(await service.execute({ type: 'library:list' })).toMatchObject({
      ok: true,
      library: library(),
    });
    expect(value()).toEqual(library());
    await service.execute({ type: 'library:list' });
    expect(storage.write).toHaveBeenCalledTimes(2);
  });
});
