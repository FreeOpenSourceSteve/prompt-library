import { useMemo, useState } from 'react';
import type { Library } from '../../domain/models';
import { MAX_CONTENT_LENGTH, MAX_PARTS } from '../../domain/models';
import { errorMessage } from '../../domain/validation';
import { createContentResolver } from '../../domain/composition';
import { ComponentPart } from './ComponentPart';
import type { ComponentDraft, ComponentEditDraft } from './editor-draft';
import { componentDraftLibrary, draftContent } from './editor-draft';

export function ComponentComposer({
  parts,
  library,
  promptId,
  disabled,
  onChange,
  edits,
  onEditChange,
}: {
  parts: ComponentDraft[];
  library: Library | null;
  promptId: string | undefined;
  disabled: boolean;
  onChange: (parts: ComponentDraft[]) => void;
  edits: ComponentEditDraft[];
  onEditChange: (edits: ComponentEditDraft[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const snapshot = useMemo(
    () => componentDraftLibrary(library, edits),
    [library, edits],
  );
  const resolver = useMemo(() => createContentResolver(snapshot), [snapshot]);
  const components = useMemo(
    () => new Map(library?.components.map((item) => [item.id, item])),
    [library],
  );
  const prompts = useMemo(
    () => new Map(library?.prompts.map((item) => [item.id, item])),
    [library],
  );
  const changes = new Map(edits.map((edit) => [edit.id, edit]));
  const search = query.trim().toLowerCase();
  const options = [
    ...snapshot.components.map((item) => ({
      type: 'component' as const,
      id: item.id,
      name: item.name,
      tags: item.tags,
    })),
    ...(library?.prompts ?? [])
      .filter((item) => item.id !== promptId)
      .map((item) => ({
        type: 'prompt' as const,
        id: item.id,
        name: item.title,
        tags: item.tags,
      })),
  ].filter((item) =>
    [item.name, ...item.tags].some((value) =>
      value.toLowerCase().includes(search),
    ),
  );
  function update(index: number, part: ComponentDraft) {
    onChange(parts.map((item, position) => (position === index ? part : item)));
  }
  function move(index: number, direction: number) {
    const next = [...parts];
    const current = next[index];
    const adjacent = next[index + direction];
    if (!current || !adjacent) return;
    next[index] = adjacent;
    next[index + direction] = current;
    onChange(next);
  }
  let preview = '';
  let previewError = '';
  try {
    preview = draftContent(parts, library, edits);
  } catch (error) {
    previewError = errorMessage(error);
  }
  return (
    <section className="component-composer" aria-label="Prompt components">
      <p className="field-help">
        Add named text or reuse a component or complete prompt. Shared edits
        appear everywhere it is used. Copy separates each text value with one
        blank line.
      </p>
      <ol className="component-parts">
        {parts.map((part, index) => {
          let text = '';
          let textError = '';
          try {
            text =
              part.type === 'new'
                ? part.content
                : part.type === 'component'
                  ? (changes.get(part.id)?.content ??
                    components.get(part.id)?.content ??
                    '')
                  : resolver.prompt(part.id);
          } catch (error) {
            textError = errorMessage(error);
          }
          return (
            <ComponentPart
              key={`${part.id}-${parts.slice(0, index).filter((item) => item.id === part.id).length}`}
              part={part}
              index={index}
              count={parts.length}
              sourceComponent={
                part.type === 'component' ? components.get(part.id) : undefined
              }
              sourcePrompt={
                part.type === 'prompt' ? prompts.get(part.id) : undefined
              }
              edit={
                part.type === 'component' ? changes.get(part.id) : undefined
              }
              text={text}
              textError={textError}
              disabled={disabled}
              onChange={(part) => update(index, part)}
              onEdit={(edit) =>
                onEditChange([
                  ...edits.filter((item) => item.id !== edit.id),
                  edit,
                ])
              }
              onUndo={() =>
                onEditChange(edits.filter((item) => item.id !== part.id))
              }
              onMove={(direction) => move(index, direction)}
              onRemove={() =>
                onChange(parts.filter((_, position) => position !== index))
              }
            />
          );
        })}
      </ol>
      <button
        type="button"
        className="button"
        disabled={disabled || parts.length >= MAX_PARTS}
        onClick={() =>
          onChange([
            ...parts,
            {
              type: 'new',
              id: crypto.randomUUID(),
              name: '',
              content: '',
              tags: '',
            },
          ])
        }
      >
        Add new component
      </button>
      <div className="component-picker">
        <label className="field">
          Find existing components or prompts
          <input
            type="search"
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected('');
            }}
            placeholder="Search by name or tag…"
          />
        </label>
        <label className="field">
          Existing component or prompt
          <select
            value={selected}
            disabled={disabled}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Choose an item…</option>
            {options.map((item) => (
              <option
                key={`${item.type}:${item.id}`}
                value={`${item.type}:${item.id}`}
              >
                {item.type === 'prompt' ? 'Prompt' : 'Component'}: {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button"
          disabled={disabled || !selected || parts.length >= MAX_PARTS}
          onClick={() => {
            const item = options.find(
              (item) => `${item.type}:${item.id}` === selected,
            );
            if (item) onChange([...parts, { type: item.type, id: item.id }]);
          }}
        >
          Add selected item
        </button>
      </div>
      <div className="component-preview">
        <div className="field-label" id="assembled-preview-label">
          Assembled prompt preview
        </div>
        {previewError ? (
          <p className="inline-error" role="status">
            {previewError}
          </p>
        ) : (
          <pre aria-labelledby="assembled-preview-label">
            {preview || 'Add components to preview your prompt.'}
          </pre>
        )}
      </div>
      <p className="field-help">
        {parts.length} / {MAX_PARTS} components ·{' '}
        {preview.length.toLocaleString()} /{' '}
        {MAX_CONTENT_LENGTH.toLocaleString()} characters. Component names must
        be unique and differ from prompt titles.
      </p>
    </section>
  );
}
