import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { backup, prompt } from '../fixtures';

test('creates, copies, filters, edits, duplicates, and deletes plain-text prompts', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/u.test(request.url())) requests.push(request.url());
  });
  const raw =
    '  # A literal heading\n<script>window.injected = true</script>\n**Never format this**  ';
  await page.getByRole('button', { name: 'New prompt', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Writing assistant');
  await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill(raw);
  await page
    .getByRole('textbox', { name: 'Tags' })
    .fill('Writing, work, WRITING');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  const card = page.getByRole('article', {
    name: 'Writing assistant',
    exact: true,
  });
  await expect(card).toBeVisible();
  await expect(card.locator('.prompt-preview')).toHaveText(raw);
  expect(await card.locator('.prompt-preview').textContent()).toBe(raw);
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  await card.getByRole('button', { name: 'Copy prompt', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Copied');
  // Copy must work with only the extension's declared permission. Grant read
  // access afterward, globally: CDP cannot scope permissions to extension origins.
  await context.grantPermissions(['clipboard-read']);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(raw);
  await card
    .getByRole('button', { name: 'Duplicate Writing assistant' })
    .click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search prompts' }).fill('(copy)');
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await card
    .getByRole('button', { name: 'Edit Writing assistant', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Refined assistant');
  await page.getByRole('textbox', { name: 'Tags' }).fill('research');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await page.getByRole('button', { name: 'Filter by research' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(
    page.getByRole('article', { name: 'Refined assistant' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Delete Refined assistant', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Delete Refined assistant', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete prompt', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(1);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('previews imports, downloads a complete backup, and rejects malformed files', async ({
  page,
}) => {
  const imported = backup();
  await page.getByLabel('Import backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(
    page.getByRole('dialog', { name: 'Import prompts' }),
  ).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Import 1 prompt', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(1);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all', exact: true }).click();
  const file = await downloaded;
  const path = await file.path();
  const result: unknown = JSON.parse(await readFile(path, 'utf8'));
  expect(result).toMatchObject({
    format: 'prompt-library',
    version: 1,
    prompts: [prompt()],
  });
  // Re-importing a backup cannot duplicate or replace saved prompts.
  await page.getByLabel('Import backup file').setInputFiles(path);
  await expect(
    page.getByRole('button', { name: 'Import 0 prompts', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await page.getByLabel('Import backup file').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await expect(page.getByRole('article')).toHaveCount(1);
});

test('refreshes other library tabs and protects conflicting drafts', async ({
  page,
  context,
  extensionId,
}) => {
  await page.getByLabel('Import backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup())),
  });
  await page
    .getByRole('button', { name: 'Import 1 prompt', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(1);
  const other = await context.newPage();
  await other.goto(`chrome-extension://${extensionId}/index.html`);
  await expect(other.getByRole('article')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Edit A useful prompt', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('My unsaved draft');
  await other
    .getByRole('button', { name: 'Edit A useful prompt', exact: true })
    .click();
  await other
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Saved in another tab');
  await other.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(
    other.getByRole('article', { name: 'Saved in another tab' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'another tab',
  );
  await expect(
    page.getByRole('textbox', { name: 'Title', exact: true }),
  ).toHaveValue('My unsaved draft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Close editor' }).click();
  await expect(
    page.getByRole('article', { name: 'Saved in another tab' }),
  ).toBeVisible();
});

test('opens its own library page and enforces local-only permissions', async ({
  page,
  worker,
  context,
}) => {
  const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
  expect(manifest.permissions).toEqual([
    'storage',
    'clipboardWrite',
    'offscreen',
  ]);
  expect(manifest.host_permissions).toBeUndefined();
  expect(manifest.content_scripts).toBeUndefined();
  expect(manifest.action?.default_popup).toBe('popup.html');
  expect(await worker.evaluate(() => chrome.action.getPopup({}))).toBe(
    new URL('popup.html', worker.url()).href,
  );
  const csp = manifest.content_security_policy;
  expect(typeof csp === 'object' ? csp.extension_pages : csp).toContain(
    "connect-src 'none'",
  );
  const opened = context.waitForEvent('page');
  await worker.evaluate(() => {
    // Exercise the same tab-opening API used by the popup's library button.
    return chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  });
  const libraryPage = await opened;
  await expect(
    libraryPage.getByRole('heading', { name: 'Your prompt library.' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
