/** Promise-based WebExtensions APIs shared by our Manifest V3 targets. */
export interface ExtensionGlobals {
  browser?: typeof chrome;
  chrome?: typeof chrome;
}

export function findExtensionApi(
  environment: ExtensionGlobals = globalThis as ExtensionGlobals,
): typeof chrome | undefined {
  return [environment.browser, environment.chrome].find((api) =>
    Boolean(api?.runtime?.id),
  );
}

export function extensionApi(): typeof chrome {
  const api = findExtensionApi();
  if (!api)
    throw new Error(
      'Open Prompt Library from your browser’s extension toolbar.',
    );
  return api;
}

export async function restrictLocalStorage(
  api = extensionApi(),
): Promise<void> {
  // This optional Chrome hardening API has different coverage and signatures
  // elsewhere. No target includes content scripts or website access.
  if (
    api.runtime.getURL('').startsWith('chrome-extension://') &&
    typeof api.storage.local.setAccessLevel === 'function'
  ) {
    // Some Chromium versions expose this method before enabling it for local
    // storage. Optional hardening must not prevent the library from loading.
    await api.storage.local
      .setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
      .catch(() => undefined);
  }
}
