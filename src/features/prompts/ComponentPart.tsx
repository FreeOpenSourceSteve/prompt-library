import { useId, useState } from 'react';
import type { Component, Prompt } from '../../domain/models';
import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from '../../domain/models';
import type { ComponentDraft, ComponentEditDraft } from './editor-draft';
import { ComponentTagsField } from './ComponentTagsField';

export function ComponentPart({
  part,
  index,
  count,
  sourceComponent,
  sourcePrompt,
  edit,
  text,
  textError,
  disabled,
  onChange,
  onEdit,
  onUndo,
  onMove,
  onRemove,
}: {
  part: ComponentDraft;
  index: number;
  count: number;
  sourceComponent: Component | undefined;
  sourcePrompt: Prompt | undefined;
  edit: ComponentEditDraft | undefined;
  text: string;
  textError: string;
  disabled: boolean;
  onChange: (part: ComponentDraft) => void;
  onEdit: (edit: ComponentEditDraft) => void;
  onUndo: () => void;
  onMove: (direction: number) => void;
  onRemove: () => void;
}) {
  const textId = useId();
  const textLabelId = useId();
  const [hidden, setHidden] = useState(false);
  const [editing, setEditing] = useState(Boolean(edit));
  const number = index + 1;
  const fields =
    part.type === 'new'
      ? part
      : (edit ??
        (sourceComponent
          ? {
              id: sourceComponent.id,
              revision: sourceComponent.revision,
              name: sourceComponent.name,
              content: sourceComponent.content,
              tags: sourceComponent.tags.join(', '),
            }
          : null));
  function update(field: 'name' | 'content' | 'tags', value: string) {
    if (part.type === 'new') onChange({ ...part, [field]: value });
    else if (fields && 'revision' in fields)
      onEdit({ ...fields, [field]: value });
  }
  const editable = part.type === 'new' || (editing && fields !== null);
  const name =
    part.type === 'new'
      ? 'New component'
      : (edit?.name ?? sourceComponent?.name ?? sourcePrompt?.title);
  const tags =
    part.type === 'new' || edit
      ? (fields?.tags ?? '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : (sourceComponent?.tags ?? sourcePrompt?.tags ?? []);
  return (
    <li className="component-part">
      <div className="component-part-heading">
        <strong>
          {number}.{' '}
          {part.type === 'prompt'
            ? 'Saved prompt'
            : part.type === 'new'
              ? 'New component'
              : 'Saved component'}
        </strong>
        <div className="component-order-actions">
          <button
            type="button"
            className="button"
            aria-label={`Move component ${number} up`}
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="button"
            aria-label={`Move component ${number} down`}
            disabled={disabled || index === count - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="button danger-text"
            aria-label={`Remove component ${number}`}
            disabled={disabled}
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </div>
      {part.type !== 'new' && (
        <p className="component-source-name">
          {name ?? 'Missing source — remove or replace this reference.'}
        </p>
      )}
      {sourceComponent && (
        <div className="component-order-actions component-edit-actions">
          <button
            type="button"
            className="button"
            disabled={disabled}
            aria-label={`${editing ? 'Done editing' : 'Edit'} component ${number}`}
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Done editing' : 'Edit component'}
          </button>
          {edit && (
            <button
              type="button"
              className="button"
              disabled={disabled}
              aria-label={`Undo edits to component ${number}`}
              onClick={onUndo}
            >
              Undo component edits
            </button>
          )}
        </div>
      )}
      {editable && fields && (
        <label className="field">
          Component name {number}
          <input
            required
            maxLength={MAX_TITLE_LENGTH}
            value={fields.name}
            disabled={disabled}
            placeholder="e.g. NCLEX tutor role"
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
      )}
      <div className="component-text-heading">
        <span className="field-label" id={textLabelId}>
          Component text {number}
        </span>
        <button
          type="button"
          className="text-button"
          disabled={disabled}
          aria-label={`${hidden ? 'Show' : 'Hide'} component ${number} text`}
          aria-expanded={!hidden}
          aria-controls={textId}
          onClick={() => setHidden(!hidden)}
        >
          {hidden ? 'Show text' : 'Hide text'}
        </button>
      </div>
      <div id={textId} hidden={hidden}>
        {editable && fields ? (
          <textarea
            className="component-text-editor"
            aria-labelledby={textLabelId}
            rows={4}
            maxLength={MAX_CONTENT_LENGTH}
            spellCheck={false}
            value={fields.content}
            disabled={disabled}
            onChange={(event) => update('content', event.target.value)}
          />
        ) : textError ? (
          <p className="inline-error" role="status">
            {textError}
          </p>
        ) : (
          <pre className="component-source-text" aria-labelledby={textLabelId}>
            {text}
          </pre>
        )}
      </div>
      {editable && fields ? (
        <ComponentTagsField
          label={`Component tags ${number}`}
          value={fields.tags ?? ''}
          disabled={disabled}
          onChange={(value) => update('tags', value)}
        />
      ) : (
        tags.length > 0 && (
          <div className="card-tags">
            {[...new Set(tags)].map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )
      )}
      {edit && (
        <p className="component-edit-help">
          Component changes save with this prompt and update every prompt that
          uses it.
        </p>
      )}
    </li>
  );
}
