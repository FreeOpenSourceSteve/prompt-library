import { test, expect } from '@playwright/test';
import { LibraryService } from '../../src/background/library-service';
import type { Library } from '../../src/domain/models';

// WebKit cannot install Safari extensions. This test checks compiled UI behavior
// with a native-browser-shaped bridge to the real domain service in Node.
// It complements, rather than substitutes for, native Safari installation QA.
test('renders the popup and editor in WebKit and preserves literal prompt text', async ({
  page,
}) => {
  let stored: Library | undefined;
  const service = new LibraryService({
    read: async () => structuredClone(stored),
    write: async (library) => {
      stored = structuredClone(library);
    },
  });
  await page.exposeFunction('testLibraryCommand', (command: unknown) =>
    service.execute(command),
  );
  await page.addInitScript(() => {
    type TestWindow = {
      testLibraryCommand: (command: unknown) => Promise<unknown>;
      browser: unknown;
    };
    const target = window as unknown as TestWindow;
    const session = new Map<string, unknown>();
    target.browser = {
      runtime: {
        id: 'webkit-rendering-test',
        getURL: (path: string) => new URL(path, location.origin).href,
        getManifest: () => ({ version: '0.1.0' }),
        sendMessage: (command: unknown) => target.testLibraryCommand(command),
      },
      storage: {
        session: {
          get: async (key: string) => ({ [key]: session.get(key) }),
          set: async (data: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(data))
              session.set(key, value);
          },
          remove: async (key: string) => {
            session.delete(key);
          },
        },
        onChanged: { addListener: () => {}, removeListener: () => {} },
      },
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/popup.html');
  await page.getByRole('button', { name: 'New prompt', exact: true }).click();
  const raw =
    '\n  # Safari / WebKit\n<b>Keep this literal</b>\n**Plain text**  ';
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('WebKit prompt');
  await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill(raw);
  await page.getByRole('textbox', { name: 'Tags' }).fill('writing');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  const card = page.getByRole('article', {
    name: 'WebKit prompt',
    exact: true,
  });
  await expect(card).toBeVisible();
  await card.locator('summary').click();
  expect(await card.locator('.popup-full-text').textContent()).toBe(raw);
  await page
    .getByRole('searchbox', { name: 'Search prompts' })
    .fill('unmatched');
  await expect(
    page.getByRole('heading', { name: 'No prompts found' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await card.getByRole('button', { name: 'Edit WebKit prompt' }).click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Edited in WebKit');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Edited in WebKit' }),
  ).toBeVisible();
  expect(stored?.prompts[0]?.content).toBe(raw);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(440);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(600);
  expect(errors).toEqual([]);
});
