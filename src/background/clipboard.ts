import { extensionApi } from '../platform/extension';

const api = extensionApi();
api.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (
    sender.id !== api.runtime.id ||
    // Older Chromium workers omit sender.url. Pages always supply it.
    (sender.url !== undefined &&
      sender.url !== api.runtime.getURL('service-worker.js')) ||
    sender.tab !== undefined ||
    typeof message !== 'object' ||
    message === null ||
    !('target' in message) ||
    message.target !== 'clipboard' ||
    !('text' in message) ||
    typeof message.text !== 'string'
  )
    return false;
  const field = document.querySelector<HTMLTextAreaElement>('#clipboard');
  if (!field) {
    sendResponse({ ok: false });
    return false;
  }
  try {
    // Offscreen documents cannot be focused, so use the extension clipboard
    // permission with the DOM copy API (navigator.clipboard requires focus).
    field.value = message.text;
    field.select();
    sendResponse({ ok: document.execCommand('copy') });
  } catch {
    sendResponse({ ok: false });
  } finally {
    field.value = '';
  }
  return false;
});
