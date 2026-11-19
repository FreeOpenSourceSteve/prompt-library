import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { component, library, prompt } from '../../../tests/fixtures';
import { PromptEditor } from './PromptEditor';
import { LibraryService } from '../../background/library-service';
import type { Library } from '../../domain/models';

it('assigns an unmarked prompt through the editor and service without entering a manual tag', async () => {
  const user = userEvent.setup();
  const original = prompt();
  let stored: Library = {
    schemaVersion: 2,
    components: [],
    prompts: [original],
  };
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
    schemaVersion: 2,
    components: [],
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

it('combines new components with saved components and complete prompts in the chosen order', async () => {
  const user = userEvent.setup();
  const role = component();
  const saved = prompt({ content: 'Complete task' });
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <PromptEditor
      prompt={null}
      library={{ ...library([saved]), components: [role] }}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Title' }),
    'Composed exam',
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Content type' }),
    'components',
  );
  await user.click(screen.getByRole('button', { name: 'Add new component' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Component name 1' }),
    'Note',
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Component text 1' }), {
    target: { value: '\nInclude citations.\n' },
  });
  const picker = screen.getByRole('combobox', {
    name: 'Existing component or prompt',
  });
  await user.selectOptions(picker, `component:${role.id}`);
  await user.click(screen.getByRole('button', { name: 'Add selected item' }));
  await user.selectOptions(picker, `prompt:${saved.id}`);
  await user.click(screen.getByRole('button', { name: 'Add selected item' }));
  await user.click(screen.getByRole('button', { name: 'Move component 2 up' }));
  expect(
    screen.getByText('Assembled prompt preview').parentElement,
  ).toHaveTextContent('Role: tutor Include citations. Complete task');
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(save).toHaveBeenCalledWith(
    {
      title: 'Composed exam',
      tags: [],
      content: [
        { type: 'component', id: role.id },
        { type: 'component', id: expect.any(String) },
        { type: 'prompt', id: saved.id },
      ],
    },
    undefined,
    [
      {
        id: expect.any(String),
        name: 'Note',
        content: '\nInclude citations.\n',
        tags: [],
      },
    ],
  );
});

it('preserves text when converting to components and back, and retains rejected drafts', async () => {
  const user = userEvent.setup();
  const save = vi
    .fn()
    .mockRejectedValue(new Error('Component names must be unique.'));
  const draft = vi.fn();
  render(
    <PromptEditor
      prompt={prompt({ content: 'Existing body' })}
      onSave={save}
      onDraftChange={draft}
      onClose={vi.fn()}
    />,
  );
  const mode = screen.getByRole('combobox', { name: 'Content type' });
  await user.selectOptions(mode, 'components');
  expect(screen.getByRole('textbox', { name: 'Component text 1' })).toHaveValue(
    'Existing body',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Component name 1' }),
    'Duplicate name',
  );
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('unique');
  expect(screen.getByRole('textbox', { name: 'Component name 1' })).toHaveValue(
    'Duplicate name',
  );
  expect(draft).toHaveBeenLastCalledWith(
    expect.objectContaining({
      parts: [
        expect.objectContaining({
          name: 'Duplicate name',
          content: 'Existing body',
        }),
      ],
    }),
  );
  await user.selectOptions(mode, 'text');
  expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveValue(
    'Existing body',
  );
});

it('shows source text by default, stages shared edits once for repeated references, and saves tags atomically', async () => {
  const user = userEvent.setup();
  const role = component({ tags: ['nursing'] });
  const original = prompt({
    content: [
      { type: 'component', id: role.id },
      { type: 'component', id: role.id },
    ],
  });
  let stored: Library = { ...library([original]), components: [role] };
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
      library={stored}
      onClose={close}
      onSave={async (input, speedCopy, newComponents, componentUpdates) => {
        const result = await service.execute({
          type: 'prompt:update',
          id: original.id,
          revision: original.revision,
          input,
          speedCopy,
          newComponents,
          componentUpdates,
        });
        if (!result.ok) throw new Error(result.error);
      }}
    />,
  );
  expect(screen.getByLabelText('Component text 1')).toHaveTextContent(
    'Role: tutor',
  );
  expect(screen.getByLabelText('Component text 2')).toBeVisible();
  await user.click(
    screen.getByRole('button', { name: 'Hide component 1 text' }),
  );
  expect(screen.getByLabelText('Component text 1')).not.toBeVisible();
  expect(screen.getByLabelText('Component text 2')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Edit component 1' }));
  await user.click(
    screen.getByRole('button', { name: 'Show component 1 text' }),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Component text 1' }), {
    target: { value: 'Updated shared role' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /Component tags 1/u }), {
    target: { value: 'Nursing, Teaching, nursing' },
  });
  expect(screen.getByLabelText('Component text 2')).toHaveTextContent(
    'Updated shared role',
  );
  expect(screen.getByLabelText('Assembled prompt preview')).toHaveTextContent(
    'Updated shared role Updated shared role',
  );
  expect(stored.components[0]).toEqual(role);
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(close).toHaveBeenCalledOnce();
  expect(stored.components[0]).toMatchObject({
    content: 'Updated shared role',
    tags: ['nursing', 'teaching'],
    revision: 2,
  });
});

it('keeps failed shared edits in the draft and supports undo and conversion to independent text', async () => {
  const user = userEvent.setup();
  const role = component();
  const saved = prompt({ content: [{ type: 'component', id: role.id }] });
  const save = vi
    .fn()
    .mockRejectedValue(new Error('This component changed in another tab.'));
  const draft = vi.fn();
  render(
    <PromptEditor
      prompt={saved}
      library={{ ...library([saved]), components: [role] }}
      onSave={save}
      onDraftChange={draft}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Edit component 1' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Component text 1' }), {
    target: { value: 'Unsaved shared edit' },
  });
  await user.click(screen.getByRole('button', { name: 'Save prompt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('another tab');
  expect(screen.getByRole('textbox', { name: 'Component text 1' })).toHaveValue(
    'Unsaved shared edit',
  );
  expect(draft).toHaveBeenLastCalledWith(
    expect.objectContaining({
      componentEdits: [
        expect.objectContaining({
          id: role.id,
          revision: 1,
          content: 'Unsaved shared edit',
        }),
      ],
    }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Undo edits to component 1' }),
  );
  expect(screen.getByRole('textbox', { name: 'Component text 1' })).toHaveValue(
    role.content,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Component text 1' }), {
    target: { value: 'Independent text' },
  });
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Content type' }),
    'text',
  );
  expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveValue(
    'Independent text',
  );
  expect(draft).toHaveBeenLastCalledWith(
    expect.not.objectContaining({ componentEdits: expect.anything() }),
  );
});
