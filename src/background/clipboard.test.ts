import { afterEach, expect, it, vi } from 'vitest';

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  respond: (response: unknown) => void,
) => boolean;
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'execCommand');
});

async function setup() {
  vi.resetModules();
  let listener: Listener = () => false;
  const getURL = (path: string) => `chrome-extension://test/${path}`;
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test',
      getURL,
      onMessage: {
        addListener: (callback: Listener) => {
          listener = callback;
        },
      },
    },
  });
  document.body.innerHTML = '<textarea id="clipboard"></textarea>';
  const execCommand = vi.fn(() => true);
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand,
  });
  await import('./clipboard');
  return {
    listener,
    execCommand,
    sender: { id: 'test', url: getURL('service-worker.js') },
    field: document.querySelector<HTMLTextAreaElement>('#clipboard')!,
  };
}

it('copies plain text from the worker and clears the temporary clipboard field', async () => {
  const { listener, sender, field, execCommand } = await setup();
  const raw = '\n  <script>literal</script>\n**Raw text**  ';
  execCommand.mockImplementation(() => {
    expect(field.value).toBe(raw);
    return true;
  });
  const respond = vi.fn();
  listener({ target: 'clipboard', text: raw }, sender, respond);
  expect(execCommand).toHaveBeenCalledWith('copy');
  expect(respond).toHaveBeenCalledWith({ ok: true });
  expect(field.value).toBe('');
});

it('rejects messages from other contexts and reports copy failures without leaving text behind', async () => {
  const { listener, sender, field, execCommand } = await setup();
  const respond = vi.fn();
  for (const source of [
    { ...sender, id: 'other' },
    { ...sender, url: 'chrome-extension://test/popup.html' },
    { ...sender, tab: {} as chrome.tabs.Tab },
  ]) {
    listener({ target: 'clipboard', text: 'Do not copy' }, source, respond);
  }
  listener({ target: 'clipboard', text: 4 }, sender, respond);
  expect(execCommand).not.toHaveBeenCalled();
  expect(respond).not.toHaveBeenCalled();
  execCommand.mockImplementation(() => {
    throw new Error('Denied');
  });
  listener({ target: 'clipboard', text: 'Temporary text' }, sender, respond);
  expect(respond).toHaveBeenCalledWith({ ok: false });
  expect(field.value).toBe('');
});

it('supports older Chromium workers without sender.url', async () => {
  const { listener, execCommand } = await setup();
  listener(
    { target: 'clipboard', text: 'Saved prompt' },
    { id: 'test' },
    vi.fn(),
  );
  expect(execCommand).toHaveBeenCalledWith('copy');
});
