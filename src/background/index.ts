import { POPUP_DRAFT_KEY, STORAGE_KEY } from '../domain/models';
import { LibraryService } from './library-service';
import { extensionApi, restrictLocalStorage } from '../platform/extension';
import { registerSpeedCopyCommands } from './speed-copy';

const api = extensionApi();
const accessReady = restrictLocalStorage(api);
// Attach a rejection handler immediately; operations still report access failures to the UI.
void accessReady.catch(() =>
  console.error('Prompt Library storage access could not be initialized.'),
);

const service = new LibraryService({
  async read() {
    await accessReady;
    const stored = await api.storage.local.get(STORAGE_KEY);
    return stored[STORAGE_KEY] as unknown;
  },
  async write(library) {
    await api.storage.local.set({ [STORAGE_KEY]: library });
  },
});

// Register listeners synchronously so events can wake a suspended MV3 worker.
registerSpeedCopyCommands(api, service);
const trustedPages = new Set([
  api.runtime.getURL('index.html'),
  api.runtime.getURL('popup.html'),
]);
api.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== api.runtime.id || !trustedPages.has(sender.url ?? ''))
    return false;
  void service.execute(message).then(async (response) => {
    // Finish draft cleanup in the background even if the browser closes the popup
    // while a successful save is still waiting for its response.
    if (
      response.ok &&
      sender.url === api.runtime.getURL('popup.html') &&
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message.type === 'prompt:create' || message.type === 'prompt:update')
    ) {
      try {
        await api.storage.session.remove(POPUP_DRAFT_KEY);
      } catch {
        console.error(
          'Prompt Library saved the prompt but could not clear its popup draft.',
        );
      }
    }
    sendResponse(response);
  });
  return true;
});
