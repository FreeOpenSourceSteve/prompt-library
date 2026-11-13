import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { backup } from '../fixtures';
import { POPUP_DRAFT_KEY } from '../../src/domain/models';

async function openPopup(page: Page, extensionId: string) {
  await page.setViewportSize({ width: 440, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(
    page.getByRole('button', { name: 'New prompt', exact: true }),
  ).toBeEnabled();
}

test('handles everyday prompt workflows in the popup and opens the full library', async ({
  page,
  context,
  extensionId,
}) => {
  await openPopup(page, extensionId);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const raw =
    '  # Plain text\n<script>window.injected = true</script>\n**Keep this literal**  ';
  await page.getByRole('button', { name: 'New prompt', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Daily writing');
  await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill(raw);
  await page.getByRole('textbox', { name: 'Tags' }).fill('writing, work');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  const card = page.getByRole('article', {
    name: 'Daily writing',
    exact: true,
  });
  await expect(card).toBeVisible();
  await card.locator('summary').click();
  expect(await card.locator('.popup-full-text').textContent()).toBe(raw);
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  await card.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Copied');
  await context.grantPermissions(['clipboard-read']);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(raw);
  await page
    .getByRole('searchbox', { name: 'Search prompts' })
    .fill('not present');
  await expect(
    page.getByRole('heading', { name: 'No prompts found' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('searchbox', { name: 'Search prompts' }).fill('WORK');
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page
    .getByRole('combobox', { name: 'Filter by tag' })
    .selectOption('writing');
  await expect(card).toBeVisible();
  await card
    .getByRole('button', { name: 'Edit Daily writing', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Refined daily prompt');
  await page.getByRole('textbox', { name: 'Tags' }).fill('research');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Refined daily prompt' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(440);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(600);
  const opened = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open full library' }).click();
  const fullPage = await opened;
  await expect(
    fullPage.getByRole('heading', { name: 'Your prompt library.' }),
  ).toBeVisible();
  await expect(
    fullPage.getByRole('article', { name: 'Refined daily prompt' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('restores an unsaved popup draft after closing and clears it after save', async ({
  page,
  context,
  extensionId,
  worker,
}) => {
  await openPopup(page, extensionId);
  await page.getByRole('button', { name: 'New prompt', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('My unfinished prompt');
  const body = '\n  Literal text\n<html>keep me</html>  ';
  await page.getByRole('textbox', { name: 'Prompt', exact: true }).fill(body);
  await expect
    .poll(() =>
      worker.evaluate(
        async (key) => (await chrome.storage.session.get(key))[key],
        POPUP_DRAFT_KEY,
      ),
    )
    .toMatchObject({
      fields: { title: 'My unfinished prompt', content: body },
    });
  await page.close();
  const reopened = await context.newPage();
  await reopened.setViewportSize({ width: 440, height: 600 });
  await reopened.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(
    reopened.getByRole('textbox', { name: 'Title', exact: true }),
  ).toHaveValue('My unfinished prompt');
  await expect(
    reopened.getByRole('textbox', { name: 'Prompt', exact: true }),
  ).toHaveValue(body);
  await reopened
    .getByRole('button', { name: 'Save prompt', exact: true })
    .click();
  await expect(
    reopened.getByRole('article', { name: 'My unfinished prompt' }),
  ).toBeVisible();
  expect(
    await worker.evaluate(
      async (key) => (await chrome.storage.session.get(key))[key],
      POPUP_DRAFT_KEY,
    ),
  ).toBeUndefined();
  await reopened.reload();
  await expect(reopened.getByRole('article')).toHaveCount(1);
  await expect(
    reopened.getByRole('textbox', { name: 'Title', exact: true }),
  ).toHaveCount(0);
});

test('syncs popup and full-page edits and preserves a conflicting popup draft', async ({
  page,
  context,
  extensionId,
  worker,
}) => {
  // Seed through the existing import flow, then use both real extension surfaces.
  await page.getByLabel('Import backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup())),
  });
  await page
    .getByRole('button', { name: 'Import 1 prompt', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(1);
  const popup = await context.newPage();
  await openPopup(popup, extensionId);
  await popup
    .getByRole('button', { name: 'Edit A useful prompt', exact: true })
    .click();
  await popup
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Popup draft');
  await page
    .getByRole('button', { name: 'Edit A useful prompt', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Updated in full library');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Updated in full library' }),
  ).toBeVisible();
  await popup.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(popup.getByRole('alert')).toContainText('another tab');
  await expect(
    popup.getByRole('textbox', { name: 'Title', exact: true }),
  ).toHaveValue('Popup draft');
  await expect
    .poll(() =>
      worker.evaluate(
        async (key) => (await chrome.storage.session.get(key))[key],
        POPUP_DRAFT_KEY,
      ),
    )
    .toMatchObject({ fields: { title: 'Popup draft' } });
  await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
  await popup
    .getByRole('dialog')
    .getByRole('button', { name: 'Keep editing' })
    .click();
  await expect(
    popup.getByRole('textbox', { name: 'Title', exact: true }),
  ).toHaveValue('Popup draft');
  await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
  await popup
    .getByRole('dialog')
    .getByRole('button', { name: 'Discard draft' })
    .click();
  await expect(
    popup.getByRole('article', { name: 'Updated in full library' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      worker.evaluate(
        async (key) => (await chrome.storage.session.get(key))[key],
        POPUP_DRAFT_KEY,
      ),
    )
    .toBeUndefined();
  await popup
    .getByRole('button', { name: 'Edit Updated in full library', exact: true })
    .click();
  await popup
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Saved from popup');
  await popup.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(
    page.getByRole('article', { name: 'Saved from popup' }),
  ).toBeVisible();
});
