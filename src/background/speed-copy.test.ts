import { expect, it, vi } from 'vitest';
import { library, prompt } from '../../tests/fixtures';
import type { LibraryService } from './library-service';
import { registerSpeedCopyCommands } from './speed-copy';

function setup(chromium = true) {
  let listener: (command: string) => Promise<unknown> = async () => {};
  const saved = {
    ...library([prompt({ tags: ['work', '!'] })]),
    speedCopy: [prompt().id, null, null],
  };
  const execute = vi.fn(async () => ({ ok: true, library: saved }));
  const api = {
    commands: {
      onCommand: {
        addListener: (callback: typeof listener) => {
          listener = callback;
        },
      },
    },
    runtime: {
      getURL: (path: string) =>
        `${chromium ? 'chrome' : 'moz'}-extension://id/${path}`,
      ContextType: { OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT' },
      getContexts: vi.fn(async () => []),
      sendMessage: vi.fn(async () => ({ ok: true })),
    },
    offscreen: {
      Reason: { CLIPBOARD: 'CLIPBOARD' },
      createDocument: vi.fn(async () => {}),
      closeDocument: vi.fn(async () => {}),
    },
    action: {
      setBadgeText: vi.fn(async () => {}),
      setTitle: vi.fn(async () => {}),
    },
  };
  registerSpeedCopyCommands(
    api as unknown as typeof chrome,
    { execute } as unknown as LibraryService,
  );
  return { api, execute, trigger: (command: string) => listener(command) };
}

it('copies through an offscreen document and cleans up without opening a tab or popup', async () => {
  const { api, trigger } = setup();
  await trigger('speed-copy-1');
  expect(api.offscreen.createDocument).toHaveBeenCalledWith(
    expect.objectContaining({ url: 'clipboard.html', reasons: ['CLIPBOARD'] }),
  );
  expect(api.runtime.sendMessage).toHaveBeenCalledWith({
    target: 'clipboard',
    text: prompt().content,
  });
  expect(api.offscreen.closeDocument).toHaveBeenCalledOnce();
  expect(api.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
});

it('leaves the clipboard alone for unassigned and unknown commands', async () => {
  const { api, execute, trigger } = setup();
  await trigger('unexpected');
  expect(execute).not.toHaveBeenCalled();
  await trigger('speed-copy-3');
  expect(api.runtime.sendMessage).not.toHaveBeenCalled();
  expect(api.action.setTitle).toHaveBeenCalledWith({
    title: expect.stringContaining('unassigned'),
  });
});

it('reports copy failures, closes the document, and processes later shortcuts', async () => {
  const { api, trigger } = setup();
  api.runtime.sendMessage.mockRejectedValueOnce(new Error('Clipboard denied'));
  await Promise.all([trigger('speed-copy-1'), trigger('speed-copy-1')]);
  expect(api.offscreen.closeDocument).toHaveBeenCalledTimes(2);
  expect(api.action.setBadgeText.mock.calls).toEqual([
    [{ text: '!' }],
    [{ text: '' }],
  ]);
});

it('uses the native clipboard in background event pages', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  const { api, trigger } = setup(false);
  await trigger('speed-copy-1');
  expect(writeText).toHaveBeenCalledWith(prompt().content);
  expect(api.offscreen.createDocument).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
