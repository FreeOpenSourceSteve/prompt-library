import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { prompt } from '../../../tests/fixtures';
import { PromptEditor } from './PromptEditor';
import { LibraryService } from '../../background/library-service';
import type { Library } from '../../domain/models';

it('assigns an unmarked prompt through the editor and service without entering a manual tag', async () => {
  const user = userEvent.setup();
  const original = prompt();
  let stored: Library = { schemaVersion: 1, prompts: [original] };
  const service = new LibraryService({
    read: async () => structuredClone(stored),
    write: async (value) => {
      stored = structuredClone(value);
    },
  });
  const close = vi.fn();
  render(
    <PromptEditor
      prompt={original}
      onClose={close}
      onSave={async (input, speedCopy) => {
        const result = await service.execute({
          type: 'prompt:update',
          id: original.id,
          revision: original.revision,
          input,
          speedCopy,
        });
        if (!result.ok) throw new Error(result.error);
      }}
    />,
  );
  const tags = screen.getByRole('textbox', { name: /^Tags/u });
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Speed-copy' }),
    '1',
  );
  expect(tags).toHaveValue('writing, work');
  expect(screen.getByLabelText('Automatic speed-copy tag')).toHaveTextContent(
    '!',
  );
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(close).toHaveBeenCalledOnce();
  expect(stored).toEqual({
    schemaVersion: 1,
    prompts: [{ ...original, tags: [...original.tags, '!'] }],
    speedCopy: [original.id, null, null],
  });
});

it('blocks saving a manual ! tag and keeps ordinary exclamation tags valid', async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockResolvedValue(undefined);
  render(<PromptEditor prompt={prompt()} onSave={save} onClose={vi.fn()} />);
  const tags = screen.getByRole('textbox', { name: /^Tags/u });
  await user.clear(tags);
  await user.type(tags, 'work, !');
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'reserved for speed-copy',
  );
  expect(save).not.toHaveBeenCalled();
  await user.clear(tags);
  await user.type(tags, 'work, important!');
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ tags: ['work', 'important!'] }),
  );
});

it('can unassign a prompt with 20 ordinary tags and the automatic marker', async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockResolvedValue(undefined);
  const saved = prompt({
    tags: [...Array.from({ length: 20 }, (_, index) => `tag${index}`), '!'],
  });
  render(
    <PromptEditor
      prompt={saved}
      initialSpeedCopy={2}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Speed-copy' }),
    '',
  );
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(save).toHaveBeenCalledWith(
    {
      title: saved.title,
      content: saved.content,
      tags: saved.tags.filter((tag) => tag !== '!'),
    },
    null,
  );
});

it('saves assignment and unassignment without changing other input', async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockResolvedValue(undefined);
  const saved = prompt({ tags: ['work', '!'] });
  render(
    <PromptEditor
      prompt={saved}
      initialSpeedCopy={1}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Speed-copy' }),
    '',
  );
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(save).toHaveBeenLastCalledWith(
    {
      title: saved.title,
      content: saved.content,
      tags: saved.tags.filter((tag) => tag !== '!'),
    },
    null,
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Speed-copy' }),
    '3',
  );
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(save).toHaveBeenLastCalledWith(
    {
      title: saved.title,
      content: saved.content,
      tags: saved.tags.filter((tag) => tag !== '!'),
    },
    3,
  );
});

it('keeps the draft visible when saving fails, then retries without losing text', async () => {
  const user = userEvent.setup();
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('Storage is full'))
    .mockResolvedValueOnce(undefined);
  const close = vi.fn();
  render(<PromptEditor prompt={prompt()} onSave={save} onClose={close} />);
  const content = screen.getByRole('textbox', { name: 'Prompt' });
  fireEvent.change(content, {
    target: { value: '\n  # Literal text\n<div>not HTML</div>  ' },
  });
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full');
  expect(content).toHaveValue('\n  # Literal text\n<div>not HTML</div>  ');
  expect(close).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      content: '\n  # Literal text\n<div>not HTML</div>  ',
    }),
  );
  expect(close).toHaveBeenCalledOnce();
});
