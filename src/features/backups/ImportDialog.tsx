import { useState } from 'react';
import type { Backup, Library } from '../../domain/models';
import { errorMessage } from '../../domain/validation';
import { Icon } from '../../app/components/Icon';
import { Modal } from '../../app/components/Modal';

export function ImportDialog({
  backup,
  library,
  onImport,
  onClose,
}: {
  backup: Backup;
  library: Library;
  onImport: () => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ids = new Set(library.prompts.map((prompt) => prompt.id));
  const additions = backup.prompts.filter((prompt) => !ids.has(prompt.id));
  const componentIds = new Set(library.components.map((item) => item.id));
  const componentAdditions = backup.components.filter(
    (item) => !componentIds.has(item.id),
  ).length;
  const skipped = backup.prompts.length - additions.length;

  async function confirm() {
    setSaving(true);
    setError('');
    try {
      await onImport();
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      titleId="import-title"
      onClose={() => {
        if (!saving) onClose();
      }}
      className="compact-modal"
    >
      <div className="modal-header">
        <div>
          <span className="eyebrow">BRING YOUR IDEAS BACK</span>
          <h2 id="import-title">Import prompts</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Cancel import"
          onClick={onClose}
          disabled={saving}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">
        <p>
          This backup has {backup.prompts.length}{' '}
          {backup.prompts.length === 1 ? 'prompt' : 'prompts'}. Import will add{' '}
          <strong>{additions.length}</strong> to your library.
        </p>
        <p>
          {componentAdditions} new components will also be added. Existing
          component IDs keep their saved text. Name conflicts or invalid
          references reject the entire import.
        </p>
        <p className="muted">
          {skipped} with existing IDs will be skipped. Your saved prompts will
          be kept, including any edits you made since this backup.
        </p>
        {additions.length > 0 && (
          <ul className="import-preview">
            {additions.slice(0, 5).map((prompt) => (
              <li key={prompt.id}>{prompt.title}</li>
            ))}
            {additions.length > 5 && <li>And {additions.length - 5} more…</li>}
          </ul>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button className="button" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          className="button primary"
          onClick={() => {
            void confirm();
          }}
          disabled={
            saving || (additions.length === 0 && componentAdditions === 0)
          }
        >
          {saving
            ? 'Importing…'
            : additions.length === 0 && componentAdditions > 0
              ? `Import ${componentAdditions} components`
              : `Import ${additions.length} ${additions.length === 1 ? 'prompt' : 'prompts'}`}
        </button>
      </div>
    </Modal>
  );
}
