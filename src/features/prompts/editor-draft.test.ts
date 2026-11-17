import { describe, expect, it } from 'vitest';
import { component, library, prompt } from '../../../tests/fixtures';
import {
  createEditorDraft,
  draftContent,
  parseEditorDraft,
} from './editor-draft';

describe('popup draft recovery', () => {
  it('keeps the saved automatic marker in the snapshot but excludes it from editable fields', () => {
    const saved = prompt({ tags: ['before', '!', 'after'] });
    const draft = createEditorDraft(saved, 1);
    expect(draft.fields.tags).toBe('before, after');
    expect(parseEditorDraft(draft)).toEqual(draft);
  });
  it('restores both the selected and original assignment including unassignment', () => {
    const draft = createEditorDraft(prompt(), 2);
    draft.fields.speedCopy = null;
    expect(parseEditorDraft(draft)).toEqual(draft);
    expect(() =>
      parseEditorDraft({ ...draft, fields: { ...draft.fields, speedCopy: 4 } }),
    ).toThrow();
  });
  it('preserves unfinished input verbatim, including invalid fields', () => {
    const draft = {
      prompt: null,
      fields: {
        title: '  ',
        content: '\n# Literal <html>  ',
        tags: 'Tag, Tag, ',
      },
    };
    expect(parseEditorDraft(draft)).toEqual(draft);
    expect(parseEditorDraft(undefined)).toBeNull();
  });
  it('retains the original prompt revision for conflict detection', () => {
    const saved = prompt({ revision: 3 });
    expect(parseEditorDraft(createEditorDraft(saved))?.prompt).toEqual(saved);
    expect(createEditorDraft(null)).toEqual({
      prompt: null,
      fields: { title: '', content: '', tags: '' },
    });
  });
  it('rejects corrupted fields and prompt snapshots', () => {
    expect(() =>
      parseEditorDraft({
        prompt: null,
        fields: { title: 1, content: '', tags: '' },
      }),
    ).toThrow();
    expect(() =>
      parseEditorDraft({
        prompt: { ...prompt(), revision: 0 },
        fields: { title: '', content: '', tags: '' },
      }),
    ).toThrow();
  });

  it('restores incomplete new components, saved references, and their order', () => {
    const saved = prompt({
      content: [{ type: 'component', id: crypto.randomUUID() }],
    });
    const draft = createEditorDraft(saved);
    const unfinished = {
      type: 'new' as const,
      id: crypto.randomUUID(),
      name: '',
      content: '\n draft text  ',
    };
    draft.fields.parts?.push(unfinished, {
      type: 'prompt',
      id: crypto.randomUUID(),
    });
    expect(parseEditorDraft(draft)).toEqual(draft);
    expect(() =>
      parseEditorDraft({
        ...draft,
        fields: { ...draft.fields, parts: [{ ...unfinished, content: 1 }] },
      }),
    ).toThrow();
    expect(() =>
      parseEditorDraft({
        ...draft,
        fields: {
          ...draft.fields,
          parts: [{ type: 'html', id: crypto.randomUUID() }],
        },
      }),
    ).toThrow();
  });

  it('preserves component edit revisions and incomplete tags, and previews nested shared edits', () => {
    const role = component();
    const child = prompt({ content: [{ type: 'component', id: role.id }] });
    const edit = {
      id: role.id,
      revision: 3,
      name: '',
      content: 'Draft text',
      tags: 'Nursing, Invalid, ',
    };
    const draft = {
      ...createEditorDraft(null),
      fields: { title: '', content: '', tags: '', componentEdits: [edit] },
    };
    expect(parseEditorDraft(draft)).toEqual(draft);
    expect(
      draftContent(
        [{ type: 'prompt', id: child.id }],
        { ...library([child]), components: [role] },
        [edit],
      ),
    ).toBe('Draft text');
    expect(() =>
      parseEditorDraft({
        ...draft,
        fields: { ...draft.fields, componentEdits: [{ ...edit, revision: 0 }] },
      }),
    ).toThrow();
    expect(() =>
      parseEditorDraft({
        ...draft,
        fields: { ...draft.fields, componentEdits: [edit, edit] },
      }),
    ).toThrow();
  });
});
