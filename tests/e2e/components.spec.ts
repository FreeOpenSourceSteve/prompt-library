import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { backup, component, prompt } from '../fixtures';
import { POPUP_DRAFT_KEY } from '../../src/domain/models';

test('creates, reuses, orders, copies, and updates components through both extension surfaces', async ({
  page,
  context,
  extensionId,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: 'New prompt', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('NCLEX exam');
  await page
    .getByRole('combobox', { name: 'Content type' })
    .selectOption('components');
  await page.getByRole('button', { name: 'Add new component' }).click();
  await page
    .getByRole('textbox', { name: 'Component name 1' })
    .fill('NCLEX tutor role');
  await page
    .getByRole('textbox', { name: 'Component text 1' })
    .fill('\nRole: tutor\n\n');
  await page.getByRole('button', { name: 'Add new component' }).click();
  await page
    .getByRole('textbox', { name: 'Component name 2' })
    .fill('Exam task');
  await page
    .getByRole('textbox', { name: 'Component text 2' })
    .fill('\r\nTask: create <literal> exam\n');
  await expect(page.locator('.component-preview pre')).toHaveText(
    'Role: tutor\n\nTask: create <literal> exam',
  );
  await page.screenshot({
    path: '/tmp/prompt-components-composer.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  const exam = page.getByRole('article', { name: 'NCLEX exam', exact: true });
  await expect(exam).toBeVisible();
  await exam.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(page.getByRole('status')).toContainText('Copied');
  await context.grantPermissions(['clipboard-read']);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'Role: tutor\n\nTask: create <literal> exam',
  );

  await page.getByRole('button', { name: 'New prompt', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Mixed exam');
  await page
    .getByRole('combobox', { name: 'Content type' })
    .selectOption('components');
  await page
    .getByRole('combobox', { name: 'Existing component or prompt' })
    .selectOption({ label: 'Prompt: NCLEX exam' });
  await page.getByRole('button', { name: 'Add selected item' }).click();
  await page.getByRole('button', { name: 'Add new component' }).click();
  await page
    .getByRole('textbox', { name: 'Component name 2' })
    .fill('Exam note');
  await page
    .getByRole('textbox', { name: 'Component text 2' })
    .fill('Include "REVIEW MODULE CHAPTER".');
  await page.getByRole('button', { name: 'Move component 2 up' }).click();
  await page.getByRole('button', { name: 'Move component 1 down' }).click();
  await page
    .getByRole('combobox', { name: 'Speed-copy', exact: true })
    .selectOption('1');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(2);

  await page
    .getByRole('button', { name: 'Manage components (3)', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Edit component NCLEX tutor role' })
    .click();
  await page
    .getByRole('textbox', { name: 'Component text', exact: true })
    .fill('Role: updated tutor');
  await page
    .getByRole('button', { name: 'Save component', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Delete component NCLEX tutor role' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(exam.locator('.prompt-preview')).toContainText('updated tutor');
  await page
    .getByRole('searchbox', { name: 'Search prompts' })
    .fill('updated tutor');
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear filters' }).click();

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 440, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const mixed = popup.getByRole('article', { name: 'Mixed exam', exact: true });
  await mixed.locator('summary').click();
  const expected =
    'Role: updated tutor\n\nTask: create <literal> exam\n\nInclude "REVIEW MODULE CHAPTER".';
  expect(await mixed.locator('.popup-full-text').textContent()).toBe(expected);
  await mixed.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(popup.getByRole('status')).toContainText('Copied');
  expect(await popup.evaluate(() => navigator.clipboard.readText())).toBe(
    expected,
  );
  await popup
    .getByRole('button', { name: 'Speed-copy 1: Mixed exam', exact: true })
    .click();
  expect(await popup.evaluate(() => navigator.clipboard.readText())).toBe(
    expected,
  );

  // An all-existing composition can be created in the popup too.
  await popup.getByRole('button', { name: 'New prompt', exact: true }).click();
  await popup
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Reused role');
  await popup
    .getByRole('combobox', { name: 'Content type' })
    .selectOption('components');
  await popup
    .getByRole('searchbox', { name: 'Find existing components or prompts' })
    .fill('tutor role');
  await popup
    .getByRole('combobox', { name: 'Existing component or prompt' })
    .selectOption({ label: 'Component: NCLEX tutor role' });
  await popup.getByRole('button', { name: 'Add selected item' }).click();
  await popup.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
  expect(
    await popup.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(440);

  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all' }).click();
  const file = await downloaded;
  const result = JSON.parse(await readFile(await file.path(), 'utf8')) as {
    version: number;
    components: unknown[];
    prompts: unknown[];
  };
  expect(result.version).toBe(2);
  expect(result.components).toHaveLength(3);
  expect(result.prompts).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('recovers unfinished component names, text, and order from a popup session draft', async ({
  page,
  context,
  extensionId,
  worker,
}) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.setViewportSize({ width: 440, height: 600 });
  await page.getByRole('button', { name: 'New prompt', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Component draft');
  await page
    .getByRole('combobox', { name: 'Content type' })
    .selectOption('components');
  await page.getByRole('button', { name: 'Add new component' }).click();
  await page
    .getByRole('textbox', { name: 'Component name 1' })
    .fill('Unfinished role');
  await page
    .getByRole('textbox', { name: 'Component text 1' })
    .fill('\nLiteral draft <html>  ');
  await expect
    .poll(() =>
      worker.evaluate(
        async (key) => (await chrome.storage.session.get(key))[key],
        POPUP_DRAFT_KEY,
      ),
    )
    .toMatchObject({
      fields: {
        parts: [
          {
            type: 'new',
            name: 'Unfinished role',
            content: '\nLiteral draft <html>  ',
          },
        ],
      },
    });
  await page.close();
  const reopened = await context.newPage();
  await reopened.setViewportSize({ width: 440, height: 600 });
  await reopened.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(
    reopened.getByRole('textbox', { name: 'Component name 1' }),
  ).toHaveValue('Unfinished role');
  await expect(
    reopened.getByRole('textbox', { name: 'Component text 1' }),
  ).toHaveValue('\nLiteral draft <html>  ');
  await reopened
    .getByRole('button', { name: 'Save prompt', exact: true })
    .click();
  await expect(
    reopened.getByRole('article', { name: 'Component draft', exact: true }),
  ).toBeVisible();
  expect(
    await worker.evaluate(
      async (key) => (await chrome.storage.session.get(key))[key],
      POPUP_DRAFT_KEY,
    ),
  ).toBeUndefined();
});

test('edits shared text and tags inside create/edit modals with per-part visibility and draft recovery', async ({
  page,
  context,
  extensionId,
  worker,
}) => {
  const role = component({ tags: ['nursing'] });
  const original = prompt({
    title: 'Original assembly',
    content: [{ type: 'component', id: role.id }],
  });
  await page.getByLabel('Import backup file').setInputFiles({
    name: 'components.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ ...backup([original]), components: [role] }),
    ),
  });
  await page
    .getByRole('button', { name: 'Import 1 prompt', exact: true })
    .click();
  await page.getByRole('button', { name: 'New prompt', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Inline assembly');
  await page
    .getByRole('combobox', { name: 'Content type' })
    .selectOption('components');
  await page
    .getByRole('searchbox', { name: 'Find existing components or prompts' })
    .fill('nursing');
  await page
    .getByRole('combobox', { name: 'Existing component or prompt' })
    .selectOption(`component:${role.id}`);
  await page.getByRole('button', { name: 'Add selected item' }).click();
  const source = page.locator('.component-source-text');
  await expect(source).toBeVisible();
  expect(await source.textContent()).toBe(role.content);
  await page.getByRole('button', { name: 'Hide component 1 text' }).click();
  await expect(source).toBeHidden();
  await page.getByRole('button', { name: 'Show component 1 text' }).click();
  await expect(source).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit component 1', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Component text 1', exact: true })
    .fill('Role: inline tutor');
  await page
    .getByRole('textbox', { name: 'Component tags 1' })
    .fill('Nursing, Teaching, nursing');
  await expect(page.locator('.component-preview pre')).toHaveText(
    'Role: inline tutor',
  );
  const styles = await page
    .locator('.component-preview pre')
    .evaluate((node) => ({
      background: getComputedStyle(node).backgroundColor,
      parentBackground: getComputedStyle(node.closest('.modal')!)
        .backgroundColor,
      font: getComputedStyle(node).fontFamily,
    }));
  expect(styles.background).not.toBe(styles.parentBackground);
  expect(styles.font).toContain('monospace');
  const labels = await page
    .locator('#assembled-preview-label, .field')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        size: getComputedStyle(node).fontSize,
        weight: getComputedStyle(node).fontWeight,
      })),
    );
  expect(new Set(labels.map((label) => label.size)).size).toBe(1);
  expect(new Set(labels.map((label) => label.weight)).size).toBe(1);
  await page.getByRole('button', { name: 'Done editing component 1' }).click();
  await page.locator('.component-preview').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: '/tmp/prompt-components-inline-edit.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(
    page
      .getByRole('article', { name: 'Original assembly' })
      .locator('.prompt-preview'),
  ).toHaveText('Role: inline tutor');
  await page.getByRole('button', { name: 'Manage components (1)' }).click();
  await page
    .getByRole('combobox', { name: 'Filter components by tag' })
    .selectOption('teaching');
  await expect(
    page.getByRole('button', { name: `Edit component ${role.name}` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page
    .getByRole('button', { name: 'Edit Inline assembly', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Edit component 1', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Component text 1' })
    .fill('Discard this edit');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page
      .getByRole('article', { name: 'Inline assembly' })
      .locator('.prompt-preview'),
  ).toHaveText('Role: inline tutor');

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 440, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup
    .getByRole('button', { name: 'Edit Inline assembly', exact: true })
    .click();
  await popup
    .getByRole('button', { name: 'Edit component 1', exact: true })
    .click();
  await popup
    .getByRole('textbox', { name: 'Component text 1' })
    .fill('Role: restored inline draft');
  await popup
    .getByRole('textbox', { name: 'Component tags 1' })
    .fill('Recovered, Nursing');
  await expect
    .poll(() =>
      worker.evaluate(
        async (key) => (await chrome.storage.session.get(key))[key],
        POPUP_DRAFT_KEY,
      ),
    )
    .toMatchObject({
      fields: {
        componentEdits: [
          {
            id: role.id,
            revision: 2,
            content: 'Role: restored inline draft',
            tags: 'Recovered, Nursing',
          },
        ],
      },
    });
  await popup.close();
  const reopened = await context.newPage();
  await reopened.setViewportSize({ width: 440, height: 600 });
  await reopened.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(
    reopened.getByRole('textbox', { name: 'Component text 1' }),
  ).toHaveValue('Role: restored inline draft');
  await expect(
    reopened.getByRole('textbox', { name: 'Component tags 1' }),
  ).toHaveValue('Recovered, Nursing');
  await reopened
    .getByRole('button', { name: 'Save prompt', exact: true })
    .click();
  await expect(
    page
      .getByRole('article', { name: 'Original assembly' })
      .locator('.prompt-preview'),
  ).toHaveText('Role: restored inline draft');
  expect(
    await reopened.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(440);
});
