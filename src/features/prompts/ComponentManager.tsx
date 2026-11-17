import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Command, Component, Library } from '../../domain/models';
import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from '../../domain/models';
import { referencingPrompts } from '../../domain/composition';
import { errorMessage, validateComponentInput } from '../../domain/validation';
import { getTags } from '../../domain/prompts';
import { ComponentTagsField } from './ComponentTagsField';
import { Modal } from '../../app/components/Modal';

export function ComponentManager({
  library,
  onMutate,
  onClose,
}: {
  library: Library;
  onMutate: (command: Command, success: string) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    component: Component | null;
    name: string;
    content: string;
    tags: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function close() {
    if (saving) return;
    const dirty =
      editing &&
      (editing.name !== (editing.component?.name ?? '') ||
        editing.content !== (editing.component?.content ?? '') ||
        editing.tags !== (editing.component?.tags ?? []).join(', '));
    if (
      !dirty ||
      window.confirm('Discard the unsaved changes to this component?')
    )
      onClose();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError('');
    try {
      const input = validateComponentInput({
        ...editing,
        tags: editing.tags.split(','),
      });
      await onMutate(
        editing.component
          ? {
              type: 'component:update',
              id: editing.component.id,
              revision: editing.component.revision,
              input,
            }
          : { type: 'component:create', input },
        'Component saved.',
      );
      setEditing(null);
      setTag(null);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  async function remove(component: Component) {
    if (!window.confirm(`Delete component “${component.name}”?`)) return;
    setSaving(true);
    setError('');
    try {
      await onMutate(
        {
          type: 'component:delete',
          id: component.id,
          revision: component.revision,
        },
        'Component deleted.',
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal titleId="components-title" onClose={close}>
      <div className="modal-header">
        <h2 id="components-title">Manage components</h2>
        <button className="button" onClick={close} disabled={saving}>
          Close
        </button>
      </div>
      <div className="modal-body">
        <p>
          Named text you can reuse in any prompt. Editing a shared component
          updates every prompt that uses it.
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {editing ? (
          <form
            onSubmit={(event) => {
              void save(event);
            }}
          >
            <label className="field">
              Component name
              <input
                autoFocus
                required
                maxLength={MAX_TITLE_LENGTH}
                value={editing.name}
                disabled={saving}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </label>
            <label className="field">
              Component text
              <textarea
                required
                rows={10}
                maxLength={MAX_CONTENT_LENGTH}
                spellCheck={false}
                value={editing.content}
                disabled={saving}
                onChange={(event) =>
                  setEditing({ ...editing, content: event.target.value })
                }
              />
            </label>
            <ComponentTagsField
              value={editing.tags}
              disabled={saving}
              onChange={(tags) => setEditing({ ...editing, tags })}
            />
            <p className="field-help">
              Choose a unique name different from every prompt title.
            </p>
            <div className="component-order-actions">
              <button
                type="button"
                className="button"
                disabled={saving}
                onClick={() => {
                  if (
                    (editing.name === (editing.component?.name ?? '') &&
                      editing.content === (editing.component?.content ?? '') &&
                      editing.tags ===
                        (editing.component?.tags ?? []).join(', ')) ||
                    window.confirm(
                      'Discard the unsaved changes to this component?',
                    )
                  ) {
                    setEditing(null);
                    setError('');
                  }
                }}
              >
                Cancel
              </button>
              <button className="button primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save component'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <label className="field">
              Search components
              <input
                type="search"
                placeholder="Search by name or tag…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="field">
              Filter components by tag
              <select
                value={tag ?? ''}
                onChange={(event) => setTag(event.target.value || null)}
              >
                <option value="">All component tags</option>
                {getTags(library.components).map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name} ({item.count})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button primary"
              disabled={saving}
              onClick={() => {
                setEditing({
                  component: null,
                  name: '',
                  content: '',
                  tags: '',
                });
                setError('');
              }}
            >
              New component
            </button>
            <ul className="component-parts">
              {library.components
                .filter(
                  (item) =>
                    (!tag || item.tags.includes(tag)) &&
                    [item.name, ...item.tags].some((value) =>
                      value.toLowerCase().includes(query.trim().toLowerCase()),
                    ),
                )
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((component) => {
                  const uses = referencingPrompts(
                    library,
                    'component',
                    component.id,
                  );
                  return (
                    <li className="component-part" key={component.id}>
                      <strong>{component.name}</strong>
                      <div className="card-tags">
                        {component.tags.map((value) => (
                          <button
                            className="tag"
                            key={value}
                            onClick={() => setTag(value)}
                            aria-label={`Filter components by ${value}`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <p className="component-excerpt">{component.content}</p>
                      <p className="field-help">
                        Used directly by {uses.length}{' '}
                        {uses.length === 1 ? 'prompt' : 'prompts'}
                        {uses.length
                          ? `: ${uses
                              .slice(0, 3)
                              .map((item) => item.title)
                              .join(', ')}`
                          : ''}
                      </p>
                      <div className="component-order-actions">
                        <button
                          className="button"
                          disabled={saving}
                          aria-label={`Edit component ${component.name}`}
                          onClick={() => {
                            setEditing({
                              component,
                              name: component.name,
                              content: component.content,
                              tags: component.tags.join(', '),
                            });
                            setError('');
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="button danger-text"
                          disabled={saving || uses.length > 0}
                          aria-label={`Delete component ${component.name}`}
                          onClick={() => {
                            void remove(component);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
            {library.components.length === 0 && (
              <p>
                No components yet. Create one here or while building a prompt.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
