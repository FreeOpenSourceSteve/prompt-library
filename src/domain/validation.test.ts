import { describe, expect, it } from 'vitest';
import { backup, library, prompt } from '../../tests/fixtures';
import {
  MAX_CONTENT_LENGTH,
  MAX_FILE_BYTES,
  MAX_PROMPTS,
  MAX_TITLE_LENGTH,
} from './models';
import {
  errorMessage,
  parseBackup,
  parseLibrary,
  validateBackup,
  validateId,
  validateInput,
  validateRevision,
} from './validation';

describe('prompt validation', () => {
  it.each(['!', ' ! ', '\t!\t'])(
    'reserves a standalone marker in user input: %j',
    (tag) => {
      expect(() => validateInput({ ...prompt(), tags: ['work', tag] })).toThrow(
        'reserved for speed-copy',
      );
    },
  );

  it('allows other tags containing exclamation marks', () => {
    expect(
      validateInput({ ...prompt(), tags: ['important!', '!sc', '!!'] }).tags,
    ).toEqual(['important!', '!sc', '!!']);
  });
  it('preserves prompt bytes and normalizes title and tags', () => {
    const content = '  # Heading\r\n<b>plain text</b>\n  ';
    expect(
      validateInput({
        title: '  My title  ',
        content,
        tags: [' Work ', 'WORK', '', 'Writing'],
      }),
    ).toEqual({ title: 'My title', content, tags: ['work', 'writing'] });
  });

  it.each([
    null,
    [],
    1,
    {},
    { title: ' ', content: 'text', tags: [] },
    { title: 'x'.repeat(MAX_TITLE_LENGTH + 1), content: 'text', tags: [] },
    { title: 'Valid', content: ' \n ', tags: [] },
    { title: 'Valid', content: 'x'.repeat(MAX_CONTENT_LENGTH + 1), tags: [] },
    { title: 'Valid', content: 'text', tags: [1] },
    {
      title: 'Valid',
      content: 'text',
      tags: Array.from({ length: 21 }, (_, i) => `tag${i}`),
    },
    { title: 'Valid', content: 'text', tags: ['x'.repeat(41)] },
    { title: 'Valid', content: 'text', tags: ['one,two'] },
    { title: 'Valid', content: 'text', tags: ['one\ntwo'] },
  ])('rejects invalid fields without silently truncating: %j', (value) => {
    expect(() => validateInput(value)).toThrow();
  });

  it('validates IDs and revisions at the message boundary', () => {
    expect(validateId(prompt().id.toUpperCase())).toBe(prompt().id);
    expect(() => validateId('__proto__')).toThrow('ID');
    expect(validateRevision(2)).toBe(2);
    for (const invalid of [0, -1, 1.2, '1', Number.MAX_SAFE_INTEGER + 1])
      expect(() => validateRevision(invalid)).toThrow('revision');
  });
});

describe('stored libraries and backups', () => {
  it('derives markers from assignments in libraries and backups without requiring existing markers', () => {
    const first = prompt({ tags: ['writing', 'work'] });
    const second = prompt({ id: crypto.randomUUID(), tags: ['other', '!'] });
    const prompts = [first, second];
    const speedCopy = [first.id, null, null];
    const expected = [
      { ...first, tags: [...first.tags, '!'] },
      { ...second, tags: ['other'] },
    ];
    expect(parseLibrary({ ...library(prompts), speedCopy })).toEqual({
      ...library(expected),
      speedCopy,
    });
    expect(validateBackup({ ...backup(prompts), speedCopy })).toEqual({
      ...backup(expected),
      speedCopy,
    });
    expect(parseLibrary(library([second])).prompts[0]).toEqual({
      ...second,
      tags: ['other'],
    });
    expect(validateBackup(backup([second])).prompts[0]).toEqual({
      ...second,
      tags: ['other'],
    });
    expect(prompts).toEqual([first, second]);
  });
  it('validates optional speed-copy slots without changing older libraries', () => {
    const marked = prompt({ tags: ['work', '!'] });
    const value = { ...library([marked]), speedCopy: [marked.id, null, null] };
    expect(parseLibrary(value)).toEqual(value);
    for (const speedCopy of [
      [],
      [marked.id],
      [marked.id, marked.id, null],
      ['invalid', null, null],
      [crypto.randomUUID(), null, null],
    ]) {
      expect(() => parseLibrary({ ...value, speedCopy })).toThrow();
    }
    expect(
      parseLibrary({ ...library(), speedCopy: [marked.id, null, null] }),
    ).toEqual({
      ...library([{ ...prompt(), tags: [...prompt().tags, '!'] }]),
      speedCopy: [marked.id, null, null],
    });
  });
  it('initializes only missing data; preserves malformed and future data by rejecting it', () => {
    expect(parseLibrary(undefined)).toEqual(library([]));
    expect(parseLibrary(library())).toEqual(library());
    expect(() => parseLibrary(null)).toThrow();
    expect(() => parseLibrary({ schemaVersion: 2, prompts: [] })).toThrow(
      'unsupported',
    );
  });

  it('round-trips a versioned backup and discards unknown fields', () => {
    expect(
      parseBackup(JSON.stringify({ ...backup(), untrusted: '<script>' })),
    ).toEqual(backup());
  });

  it.each([
    'not JSON',
    JSON.stringify({ ...backup(), version: 99 }),
    JSON.stringify({ ...backup(), format: 'another-app' }),
    JSON.stringify(backup([prompt(), prompt()])),
    JSON.stringify(backup([prompt({ updatedAt: '2025-01-01T00:00:00.000Z' })])),
    JSON.stringify(backup([prompt({ createdAt: 'yesterday' })])),
    JSON.stringify({ ...backup(), exportedAt: '2026-02-01' }),
    JSON.stringify({ ...backup(), prompts: 'not an array' }),
  ])('rejects invalid or unsupported backup data', (value) => {
    expect(() => parseBackup(value)).toThrow();
  });

  it('rejects oversized files before parsing', () => {
    expect(() => parseBackup(' '.repeat(MAX_FILE_BYTES + 1))).toThrow('8 MB');
  });
  it('rejects libraries with too many prompts', () => {
    expect(() =>
      validateBackup(
        backup(Array.from({ length: MAX_PROMPTS + 1 }, () => prompt())),
      ),
    ).toThrow('2,000');
  });
  it('provides a safe error fallback', () => {
    expect(errorMessage(new Error('Helpful error'))).toBe('Helpful error');
    expect(errorMessage(null)).toMatch('Something went wrong');
  });
});
