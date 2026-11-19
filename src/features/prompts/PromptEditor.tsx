import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  Library,
  NewComponent,
  ComponentUpdate,
  Prompt,
  PromptInput,
  SpeedCopySlot,
} from '../../domain/models';
import {
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  SPEED_COPY_SLOTS,
} from '../../domain/models';
import { errorMessage, validateInput } from '../../domain/validation';
import { Icon } from '../../app/components/Icon';
import { Modal } from '../../app/components/Modal';
import type { EditorFields } from './editor-draft';
import {
  createEditorDraft,
  componentInput,
  componentUpdates,
  draftContent,
} from './editor-draft';
import { ComponentComposer } from './ComponentComposer';
import { ordinaryTags } from '../../domain/speed-copy';

export function PromptEditor({
  prompt,
  onSave,
  onClose,
  layout = 'modal',
  initialFields,
  onDraftChange,
  library = null,
  initialSpeedCopy = null,
}: {
  prompt: Prompt | null;
  onSave: (
    input: PromptInput,
    speedCopy?: SpeedCopySlot | null,
    newComponents?: NewComponent[],
    updates?: ComponentUpdate[],
  ) => Promise<void>;
  onClose: () => void;
  layout?: 'modal' | 'panel';
  initialFields?: EditorFields;
  onDraftChange?: (fields: EditorFields) => void;
  library?: Library | null;
  initialSpeedCopy?: SpeedCopySlot | null;
}) {
  const [originalSpeedCopy] = useState(initialSpeedCopy);
  const [fields, setFields] = useState<EditorFields>(
    () => initialFields ?? createEditorDraft(prompt, originalSpeedCopy).fields,
  );
  const { title, content, tags, parts } = fields;
  const componentEdits = fields.componentEdits ?? [];
  function replaceFields(next: EditorFields) {
    setFields(next);
    onDraftChange?.(next);
  }
  const speedCopy =
    fields.speedCopy === undefined ? originalSpeedCopy : fields.speedCopy;
  function change<K extends keyof EditorFields>(
    field: K,
    value: EditorFields[K],
  ) {
    const next = { ...fields, [field]: value };
    replaceFields(next);
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty =
    componentEdits.length > 0 ||
    title !== (prompt?.title ?? '') ||
    content !== (typeof prompt?.content === 'string' ? prompt.content : '') ||
    JSON.stringify(parts) !==
      JSON.stringify(
        Array.isArray(prompt?.content) ? prompt.content : undefined,
      ) ||
    tags !== ordinaryTags(prompt?.tags ?? []).join(', ') ||
    speedCopy !== originalSpeedCopy;

  useEffect(() => {
    if (!dirty || layout === 'panel') return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, layout]);

  function close() {
    if (saving) return;
    if (dirty && layout === 'panel') {
      setConfirmDiscard(true);
      return;
    }
    if (!dirty || window.confirm('Discard the unsaved changes to this prompt?'))
      onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const composition = parts ? componentInput(parts) : null;
      const input = validateInput({
        title,
        content: composition?.content ?? content,
        tags: tags.split(','),
      });
      const updates = componentUpdates(componentEdits);
      if (updates.length)
        await onSave(
          input,
          speedCopy === originalSpeedCopy ? undefined : speedCopy,
          composition?.newComponents ?? [],
          updates,
        );
      else if (composition?.newComponents.length)
        await onSave(
          input,
          speedCopy === originalSpeedCopy ? undefined : speedCopy,
          composition.newComponents,
        );
      else if (speedCopy !== originalSpeedCopy) await onSave(input, speedCopy);
      else await onSave(input);
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const form = (
    <form
      className="prompt-editor-form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <div className="modal-header">
        <div>
          <span className="eyebrow">YOUR LIBRARY</span>
          <h2 id="editor-title">{prompt ? 'Edit prompt' : 'New prompt'}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close editor"
          onClick={close}
          disabled={saving}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">
        <label className="field">
          Title
          <input
            name="title"
            autoFocus
            required
            maxLength={MAX_TITLE_LENGTH}
            value={title}
            onChange={(event) => change('title', event.target.value)}
            placeholder="Give your prompt a useful name"
            disabled={saving}
          />
        </label>
        <label className="field">
          Content type
          <select
            value={parts ? 'components' : 'text'}
            disabled={saving}
            onChange={(event) => {
              if (event.target.value === 'components') {
                replaceFields({
                  ...fields,
                  parts: content
                    ? [
                        {
                          type: 'new',
                          id: crypto.randomUUID(),
                          name: '',
                          content,
                          tags: '',
                        },
                      ]
                    : [],
                });
              } else {
                try {
                  const next = {
                    ...fields,
                    content: draftContent(parts ?? [], library, componentEdits),
                  };
                  delete next.parts;
                  delete next.componentEdits;
                  replaceFields(next);
                  setError('');
                } catch (error) {
                  setError(errorMessage(error));
                }
              }
            }}
          >
            <option value="text">Plain text</option>
            <option value="components">Multiple components</option>
          </select>
        </label>
        {parts ? (
          <ComponentComposer
            parts={parts}
            library={library}
            promptId={prompt?.id}
            disabled={saving}
            edits={componentEdits}
            onEditChange={(componentEdits) =>
              change('componentEdits', componentEdits)
            }
            onChange={(parts) =>
              replaceFields({
                ...fields,
                parts,
                componentEdits: componentEdits.filter((edit) =>
                  parts.some(
                    (part) => part.type === 'component' && part.id === edit.id,
                  ),
                ),
              })
            }
          />
        ) : (
          <>
            <label className="field">
              Prompt
              <textarea
                name="content"
                required
                maxLength={MAX_CONTENT_LENGTH}
                rows={layout === 'panel' ? 7 : 12}
                spellCheck={false}
                value={content}
                onChange={(event) => change('content', event.target.value)}
                placeholder="Write or paste your prompt here…"
                disabled={saving}
                aria-describedby="content-help"
              />
            </label>
            <p id="content-help" className="field-help">
              Plain text, exactly as you write it. Formatting is never rendered.{' '}
              <span>
                {content.length.toLocaleString()} /{' '}
                {MAX_CONTENT_LENGTH.toLocaleString()}
              </span>
            </p>
          </>
        )}
        <label className="field">
          Tags <span className="optional">optional</span>
          <input
            name="tags"
            value={tags}
            onChange={(event) => change('tags', event.target.value)}
            placeholder="writing, research, everyday"
            disabled={saving}
            aria-describedby="tags-help"
          />
        </label>
        <p id="tags-help" className="field-help">
          Separate tags with commas. Up to 20 tags, 40 characters each. Tags are
          saved in lowercase. The ! tag is reserved for speed-copy and cannot be
          entered here.
        </p>
        <label className="field">
          Speed-copy
          <select
            value={speedCopy ?? ''}
            onChange={(event) =>
              change(
                'speedCopy',
                event.target.value
                  ? (Number(event.target.value) as SpeedCopySlot)
                  : null,
              )
            }
            disabled={saving}
            aria-describedby="speed-copy-help"
          >
            <option value="">Unassigned</option>
            {SPEED_COPY_SLOTS.map((slot) => {
              const occupant = library?.prompts.find(
                (item) => item.id === library.speedCopy?.[slot - 1],
              );
              return (
                <option key={slot} value={slot}>
                  {slot}
                  {occupant && occupant.id !== prompt?.id
                    ? ` — Replace “${occupant.title}”`
                    : ''}
                </option>
              );
            })}
          </select>
        </label>
        <p id="speed-copy-help" className="field-help">
          Save to assign or unassign. The ! tag is added or removed
          automatically; other tags stay as entered.
        </p>
        {speedCopy !== null && (
          <p
            className="field-help"
            role="status"
            aria-label="Automatic speed-copy tag"
          >
            <span className="tag">!</span> Automatic tag for speed-copy{' '}
            {speedCopy}. Managed by your assignment.
          </p>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {layout === 'panel' && (
          <p className="draft-help">
            Draft kept during this browser session. Save to add it to your
            library.
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button
          type="button"
          className="button"
          onClick={close}
          disabled={saving}
        >
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save prompt'}
        </button>
      </div>
    </form>
  );
  return layout === 'panel' ? (
    <section className="popup-editor" aria-labelledby="editor-title">
      {form}
      {confirmDiscard && (
        <Modal
          titleId="discard-title"
          onClose={() => setConfirmDiscard(false)}
          className="compact-modal"
        >
          <div className="modal-header">
            <h2 id="discard-title">Discard unsaved changes?</h2>
          </div>
          <div className="modal-body">
            <p>
              This removes the current draft. Your saved prompt will stay in the
              library.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="button"
              onClick={() => setConfirmDiscard(false)}
              autoFocus
            >
              Keep editing
            </button>
            <button className="button danger" onClick={onClose}>
              Discard draft
            </button>
          </div>
        </Modal>
      )}
    </section>
  ) : (
    <Modal titleId="editor-title" onClose={close}>
      {form}
    </Modal>
  );
}
