import type { Command, Library, Response } from '../domain/models';
import { STORAGE_KEY } from '../domain/models';
import { parseLibrary } from '../domain/validation';
import { extensionApi, findExtensionApi } from './extension';

export function isExtensionContext(): boolean {
  return Boolean(findExtensionApi());
}

export async function sendCommand(
  command: Command,
): Promise<Extract<Response, { ok: true }>> {
  let response: Response | undefined;
  try {
    response = await extensionApi().runtime.sendMessage<Command, Response>(
      command,
    );
  } catch {
    throw new Error(
      'The extension connection was interrupted. Reopen Prompt Library from your browser’s extension toolbar.',
    );
  }
  if (!response)
    throw new Error(
      'The extension did not respond. Reopen Prompt Library from your browser’s extension toolbar.',
    );
  if (!response.ok) throw new Error(response.error);
  return response;
}

export function subscribeToLibrary(
  onChange: (library: Library) => void,
  onError: (error: unknown) => void,
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !(STORAGE_KEY in changes)) return;
    try {
      onChange(parseLibrary(changes[STORAGE_KEY]?.newValue));
    } catch (error) {
      onError(error);
    }
  };
  const api = extensionApi();
  api.storage.onChanged.addListener(listener);
  return () => api.storage.onChanged.removeListener(listener);
}
