import { describe, expect, it } from 'vitest';
import { backup, component, library, prompt } from '../../tests/fixtures';
import type { Library } from './models';
import { MAX_COMPOSITION_DEPTH, MAX_PARTS } from './models';
import {
  createContentResolver,
  joinComponentText,
  validateComposition,
} from './composition';
import {
  parseLibrary,
  validateBackup,
  validateComponentInput,
  validateInput,
} from './validation';
import { createBackup, libraryContent, selectPrompts } from './prompts';

describe('component metadata and expansion', () => {
  it('expands ordered nested prompts, repeated components, and literal text with one blank line', () => {
    const role = component();
    const task = component({
      name: 'Task',
      content: '\r\nTask: "NCLEX" <literal>\r\n \r\n',
    });
    const child = prompt({
      content: [
        { type: 'component', id: role.id },
        { type: 'component', id: task.id },
      ],
    });
    const parent = prompt({
      id: crypto.randomUUID(),
      title: 'Parent',
      content: [
        { type: 'prompt', id: child.id },
        { type: 'component', id: role.id },
      ],
    });
    const value = { ...library([parent, child]), components: [role, task] };
    validateComposition(value);
    const resolve = libraryContent(value);
    expect(resolve(parent.id)).toBe(
      'Role: tutor\n\nTask: "NCLEX" <literal>\n\nRole: tutor',
    );
    expect(
      selectPrompts(value.prompts, 'nclex', null, 'title', resolve),
    ).toHaveLength(2);
    expect(value.components[0]?.content).toBe('\nRole: tutor\n\n');
    expect(libraryContent(value)).toBe(resolve);
  });

  it('preserves standalone text verbatim and internal blank lines in compositions', () => {
    expect(createContentResolver(library()).prompt(prompt().id)).toBe(
      prompt().content,
    );
    expect(
      joinComponentText(['\n  First\n\ninside  \n\n', '\r\nSecond\n']),
    ).toBe('  First\n\ninside  \n\nSecond');
  });

  it('validates large shared graphs and renders bounded previews without flattening every prompt', () => {
    const part = component({ content: 'x'.repeat(49_999) });
    const leaf = prompt({
      content: [
        { type: 'component', id: part.id },
        { type: 'component', id: part.id },
      ],
    });
    const prompts = [
      leaf,
      ...Array.from({ length: 1999 }, (_, index) =>
        prompt({
          id: crypto.randomUUID(),
          title: `Shared ${index}`,
          content: [{ type: 'prompt', id: leaf.id }],
        }),
      ),
    ];
    const value = { ...library(prompts), components: [part] };
    expect(() => validateComposition(value)).not.toThrow();
    const resolver = createContentResolver(value);
    expect(resolver.preview(prompts[1999]!.id)).toBe('x'.repeat(1000));
    // More than the cache budget exercises eviction while preserving exact output.
    for (const item of prompts.slice(0, 12))
      expect(resolver.prompt(item.id)).toBe(
        `${part.content}\n\n${part.content}`,
      );
    expect(resolver.prompt(leaf.id)).toHaveLength(100_000);
  });

  it('rejects dangling references and cycles, including indirect cycles', () => {
    const first = prompt({ content: [{ type: 'prompt', id: prompt().id }] });
    expect(() => parseLibrary(library([first]))).toThrow('circular');
    const second = prompt({
      id: crypto.randomUUID(),
      title: 'Child',
      content: [{ type: 'prompt', id: first.id }],
    });
    first.content = [{ type: 'prompt', id: second.id }];
    expect(() => parseLibrary(library([first, second]))).toThrow('circular');
    for (const type of ['component', 'prompt'] as const)
      expect(() =>
        parseLibrary(
          library([prompt({ content: [{ type, id: crypto.randomUUID() }] })]),
        ),
      ).toThrow('no longer exists');
  });

  it('enforces length before joining repeated references and checks cached graph depth', () => {
    const body = component({ content: 'x'.repeat(50_000) });
    const composed = prompt({
      content: [
        { type: 'component', id: body.id },
        { type: 'component', id: body.id },
      ],
    });
    expect(() =>
      parseLibrary({ ...library([composed]), components: [body] }),
    ).toThrow('100,000');
    const prompts = [prompt({ content: 'Leaf' })];
    for (let i = 0; i < MAX_COMPOSITION_DEPTH; i++) {
      prompts.push(
        prompt({
          id: crypto.randomUUID(),
          title: `Level ${i}`,
          content: [{ type: 'prompt', id: prompts.at(-1)!.id }],
        }),
      );
    }
    // Child-first order exercises the cached-depth path, root-first the DFS path.
    expect(() => parseLibrary(library(prompts))).not.toThrow();
    prompts.push(
      prompt({
        id: crypto.randomUUID(),
        content: [{ type: 'prompt', id: prompts.at(-1)!.id }],
      }),
    );
    expect(() => parseLibrary(library(prompts))).toThrow('32');
    expect(() => parseLibrary(library([...prompts].reverse()))).toThrow('32');
  });

  it('validates reference types, bounds, duplicate IDs, and normalized component namespaces', () => {
    for (const content of [
      [],
      Array.from({ length: MAX_PARTS + 1 }, () => ({
        type: 'prompt',
        id: prompt().id,
      })),
      [{ type: 'html', id: prompt().id }],
      [{ type: 'component', id: 'bad' }],
    ])
      expect(() =>
        validateInput({ title: 'Composition', content, tags: [] }),
      ).toThrow();
    const first = component({ name: ' Café ' });
    for (const second of [
      component({ name: 'CAFE\u0301' }),
      component({ id: first.id, name: 'Other' }),
    ])
      expect(() =>
        parseLibrary({ ...library(), components: [first, second] }),
      ).toThrow();
    expect(() =>
      parseLibrary({
        ...library([prompt({ title: 'CAFÉ' })]),
        components: [first],
      }),
    ).toThrow('names');
    expect(() =>
      parseLibrary({
        ...library(),
        components: [component({ id: prompt().id })],
      }),
    ).toThrow('IDs');
  });
});

describe('versioned component storage', () => {
  it('normalizes component tags, restores older untagged records, and rejects malformed tag fields', () => {
    const old = { ...component() } as Partial<ReturnType<typeof component>>;
    delete old.tags;
    expect(
      parseLibrary({ ...library([]), components: [old] }).components[0]?.tags,
    ).toEqual([]);
    expect(
      validateBackup({ ...backup([]), components: [old] }).components[0]?.tags,
    ).toEqual([]);
    expect(
      validateComponentInput({
        name: 'Tagged role',
        content: 'Role text',
        tags: [' Nursing ', 'NURSING', 'Cafe\u0301'],
      }).tags,
    ).toEqual(['nursing', 'café']);
    for (const tags of [
      null,
      'tag',
      [1],
      ['!'],
      ['x'.repeat(41)],
      ['one,two'],
      ['one\ntwo'],
      Array.from({ length: 21 }, (_, index) => `tag${index}`),
    ])
      expect(() =>
        validateComponentInput({ name: 'Role', content: 'Text', tags }),
      ).toThrow();
  });
  it('migrates version 1 without changing text or metadata and exports version 2', () => {
    const legacy = {
      schemaVersion: 1,
      prompts: [prompt()],
      speedCopy: [prompt().id, null, null],
    };
    const migrated = parseLibrary(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.components).toEqual([]);
    expect(migrated.prompts[0]).toEqual({
      ...prompt(),
      tags: [...prompt().tags, '!'],
    });
    expect(legacy.prompts[0]).toEqual(prompt());
    expect(
      validateBackup({ ...backup(), version: 1, components: undefined }),
    ).toEqual(backup());
    const exported = createBackup(migrated);
    expect(validateBackup(exported)).toEqual(exported);
  });

  it('round trips components and references, dropping unrecognized fields', () => {
    const part = component();
    const value: Library = {
      ...library([prompt({ content: [{ type: 'component', id: part.id }] })]),
      components: [part],
    };
    expect(parseLibrary(value)).toEqual(value);
    expect(validateBackup({ ...createBackup(value), unknown: true })).toEqual(
      createBackup(value),
    );
    expect(() => parseLibrary({ ...value, schemaVersion: 1 })).toThrow(
      'plain text',
    );
    expect(() =>
      validateBackup({ ...createBackup(value), version: 1 }),
    ).toThrow('plain text');
  });
});
