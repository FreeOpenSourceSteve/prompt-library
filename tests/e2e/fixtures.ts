import { test as base, expect } from '@playwright/test';
import type { BrowserContext, Worker } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  worker: Worker;
}>({
  context: async ({ playwright }, provide) => {
    const profile = await mkdtemp(join(tmpdir(), 'prompt-library-test-'));
    const extension = resolve('dist');
    const context = await playwright.chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      viewport: { width: 1440, height: 1000 },
      args: ['--enable-unsafe-extension-debugging'],
    });
    try {
      // Explicit installation avoids platform-dependent side-loading flags.
      // These debugging permissions apply only to this isolated test browser.
      const browser = context.browser();
      if (!browser)
        throw new Error('The extension test browser did not start.');
      const session = await browser.newBrowserCDPSession();
      try {
        await session.send('Extensions.loadUnpacked', { path: extension });
      } finally {
        await session.detach();
      }
      await provide(context);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
  worker: async ({ context }, provide) => {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker', { timeout: 15_000 }));
    await provide(worker);
  },
  extensionId: async ({ worker }, provide) => {
    await provide(new URL(worker.url()).host);
  },
  page: async ({ context, extensionId }, provide) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await expect(
      page.getByRole('button', { name: 'New prompt', exact: true }),
    ).toBeEnabled();
    await provide(page);
  },
});

export { expect };
