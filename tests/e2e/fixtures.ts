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
      viewport: { width: 1440, height: 1000 },
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
    try {
      await provide(context);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
  worker: async ({ context }, provide) => {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
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
