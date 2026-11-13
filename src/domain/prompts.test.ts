import { describe, expect, it } from 'vitest';
import { backup, library, prompt } from '../../tests/fixtures';
import { createBackup, getTags, selectPrompts } from './prompts';

const first = prompt({ title: 'Zebra', tags: ['work', 'writing'] });
const second = prompt({
  id: '7d409b83-2570-4451-87c1-8f55a881c23b',
  title: 'Alpha',
  content: 'A research task',
  tags: ['research', 'work'],
  createdAt: '2026-01-03T12:00:00.000Z',
  updatedAt: '2026-01-03T12:00:00.000Z',
});

describe('prompt selection', () => {
  it('combines case-insensitive search with an exact tag filter', () => {
    expect(
      selectPrompts([first, second], ' RESEARCH ', 'work', 'updated'),
    ).toEqual([second]);
    expect(
      selectPrompts([first, second], 'research', 'writing', 'updated'),
    ).toEqual([]);
    expect(selectPrompts([first, second], 'zEbRa', null, 'updated')).toEqual([
      first,
    ]);
  });
  it('sorts without mutating the input', () => {
    const input = [first, second];
    expect(selectPrompts(input, '', null, 'updated')).toEqual([second, first]);
    expect(selectPrompts(input, '', null, 'oldest')).toEqual([first, second]);
    expect(selectPrompts(input, '', null, 'title')).toEqual([second, first]);
    expect(input).toEqual([first, second]);
    expect(
      selectPrompts(
        [second, { ...first, title: 'Alpha' }],
        '',
        null,
        'title',
      )[0]?.id,
    ).toBe(first.id);
    expect(
      selectPrompts(
        [second, { ...first, updatedAt: second.updatedAt }],
        '',
        null,
        'updated',
      )[0]?.id,
    ).toBe(second.id);
  });
  it('counts and alphabetizes tags', () => {
    expect(getTags([first, second])).toEqual([
      { name: 'research', count: 1 },
      { name: 'work', count: 2 },
      { name: 'writing', count: 1 },
    ]);
  });
  it('exports all prompts with metadata and exact text intact', () => {
    expect(createBackup(library(), new Date(backup().exportedAt))).toEqual(
      backup(),
    );
  });
});
