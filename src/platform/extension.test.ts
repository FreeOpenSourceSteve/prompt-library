import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extensionApi,
  findExtensionApi,
  restrictLocalStorage,
} from './extension';
import type { ExtensionGlobals } from './extension';

afterEach(() => vi.unstubAllGlobals());
function api(scheme = 'chrome-extension', hardening = true): typeof chrome {
  return {
    runtime: { id: 'test', getURL: () => `${scheme}://test/` },
    storage: {
      local: hardening
        ? { setAccessLevel: vi.fn().mockResolvedValue(undefined) }
        : {},
    },
  } as unknown as typeof chrome;
}
describe('native extension API selection', () => {
  it('prefers native browser APIs and falls back to Chrome on older Chromium', () => {
    const firefox = api('moz-extension');
    const chrome = api();
    expect(findExtensionApi({ browser: firefox, chrome })).toBe(firefox);
    expect(findExtensionApi({ chrome })).toBe(chrome);
    expect(
      findExtensionApi({ browser: {} } as ExtensionGlobals),
    ).toBeUndefined();
    expect(findExtensionApi({})).toBeUndefined();
  });
  it('reports non-extension contexts with a browser-neutral message', () => {
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', undefined);
    expect(() => extensionApi()).toThrow('browser’s extension toolbar');
  });
  it('feature-detects optional Chrome hardening without calling it on Firefox or Safari', async () => {
    const chrome = api();
    await restrictLocalStorage(chrome);
    expect(chrome.storage.local.setAccessLevel).toHaveBeenCalledWith({
      accessLevel: 'TRUSTED_CONTEXTS',
    });
    await expect(
      restrictLocalStorage(api('chrome-extension', false)),
    ).resolves.toBeUndefined();
    const unsupported = api();
    vi.mocked(unsupported.storage.local.setAccessLevel).mockRejectedValueOnce(
      new Error('Unsupported storage area'),
    );
    await expect(restrictLocalStorage(unsupported)).resolves.toBeUndefined();
    for (const scheme of ['moz-extension', 'safari-web-extension']) {
      const other = api(scheme);
      await restrictLocalStorage(other);
      expect(other.storage.local.setAccessLevel).not.toHaveBeenCalled();
    }
  });
});
