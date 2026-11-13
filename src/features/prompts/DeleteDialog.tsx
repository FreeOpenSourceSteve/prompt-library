import { useState } from 'react';
import type { Prompt } from '../../domain/models';
import { errorMessage } from '../../domain/validation';
import { Modal } from '../../app/components/Modal';

export function DeleteDialog({
  prompt,
  onDelete,
  onClose,
}: {
  prompt: Prompt;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      titleId="delete-title"
      onClose={() => {
        if (!saving) onClose();
      }}
      className="compact-modal"
    >
      <div className="modal-header">
        <h2 id="delete-title">Delete prompt?</h2>
      </div>
      <div className="modal-body">
        <p>
          “{prompt.title}” will be permanently removed from this library. You
          can restore it if you have an exported backup.
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button
          className="button"
          onClick={onClose}
          disabled={saving}
          autoFocus
        >
          Cancel
        </button>
        <button
          className="button danger"
          onClick={() => {
            void confirm();
          }}
          disabled={saving}
        >
          {saving ? 'Deleting…' : 'Delete prompt'}
        </button>
      </div>
    </Modal>
  );
}
