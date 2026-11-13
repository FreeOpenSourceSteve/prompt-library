import { describe, expect, it } from 'vitest';
import { prompt } from '../../../tests/fixtures';
import { createEditorDraft, parseEditorDraft } from './editor-draft';

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
});
