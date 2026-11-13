import { useEffect, useRef, useState } from 'react';
import type { EditorDraft } from '../features/prompts/editor-draft';
import { parseEditorDraft } from '../features/prompts/editor-draft';
import { isExtensionContext } from '../platform/client';
import { POPUP_DRAFT_KEY } from '../domain/models';
import { extensionApi } from '../platform/extension';

export function usePopupDraft() {
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draftError, setDraftError] = useState('');
  const pending = useRef(new Set<Promise<void>>());

  useEffect(() => {
    if (!isExtensionContext()) return;
    let active = true;
    void extensionApi()
      .storage.session.get(POPUP_DRAFT_KEY)
      .then((data) => {
        if (active) setDraft(parseEditorDraft(data[POPUP_DRAFT_KEY]));
      })
      .catch(() => {
        if (active)
          setDraftError(
            'The previous draft could not be restored. You can still add or edit prompts.',
          );
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateDraft(value: EditorDraft | null) {
    setDraft(value);
    // Issue every write immediately. A debounce or a popup-owned promise queue
    // could lose the last keystrokes when the browser destroys the popup document.
    const operation =
      value === null
        ? extensionApi().storage.session.remove(POPUP_DRAFT_KEY)
        : extensionApi().storage.session.set({ [POPUP_DRAFT_KEY]: value });
    pending.current.add(operation);
    void operation
      .then(() => setDraftError(''))
      .catch(() => {
        setDraftError(
          'Draft recovery is unavailable. Save your prompt before closing this popup.',
        );
      })
      .finally(() => {
        pending.current.delete(operation);
      });
  }

  async function flushDraft() {
    await Promise.allSettled([...pending.current]);
  }

  return { draft, loaded, draftError, updateDraft, flushDraft };
}
