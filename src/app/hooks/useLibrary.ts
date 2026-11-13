import { useCallback, useEffect, useRef, useState } from 'react';
import type { Library } from '../../domain/models';
import { errorMessage } from '../../domain/validation';
import {
  isExtensionContext,
  sendCommand,
  subscribeToLibrary,
} from '../../platform/client';

export function useLibrary() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState('');
  const lifecycle = useRef({ request: 0, active: false });

  const reload = useCallback(async () => {
    const current = ++lifecycle.current.request;
    try {
      const result = await sendCommand({ type: 'library:list' });
      if (lifecycle.current.active && current === lifecycle.current.request) {
        setLibrary(result.library);
        setLoadError('');
      }
    } catch (error) {
      if (lifecycle.current.active && current === lifecycle.current.request)
        setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    if (!isExtensionContext()) return;
    const state = lifecycle.current;
    state.active = true;
    const unsubscribe = subscribeToLibrary(
      () => {
        void reload();
      },
      (error) => setLoadError(errorMessage(error)),
    );
    // Defer the initial request; state updates arrive from the external storage service.
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      state.active = false;
      ++state.request;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [reload]);

  return { library, loadError, reload };
}
