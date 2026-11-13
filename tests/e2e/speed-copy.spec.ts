import { test, expect } from './fixtures';
import { backup, prompt } from '../fixtures';
import { STORAGE_KEY } from '../../src/domain/models';

test('assigns from both editors, copies the exact text, and preserves metadata on replacement and unassignment', async ({
  page,
  context,
  extensionId,
  worker,
}) => {
  const first = prompt();
  const second = prompt({
    id: crypto.randomUUID(),
    title: 'Second prompt',
    tags: ['another', 'work'],
  });
  await page.getByLabel('Import backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup([first, second]))),
  });
  await page
    .getByRole('button', { name: 'Import 2 prompts', exact: true })
    .click();
  await expect(page.getByRole('article')).toHaveCount(2);
  await page
    .getByRole('button', { name: `Edit ${first.title}`, exact: true })
    .click();
  const tags = page.getByRole('textbox', { name: 'Tags' });
  await tags.fill('writing, work, !');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'reserved for speed-copy',
  );
  await tags.fill('writing, work');
  await page
    .getByRole('combobox', { name: 'Speed-copy', exact: true })
    .selectOption('1');
  await expect(tags).toHaveValue('writing, work');
  await expect(page.getByLabel('Automatic speed-copy tag')).toContainText('!');
  await page.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const read = () =>
    worker.evaluate(
      async (key) => (await chrome.storage.local.get(key))[key],
      STORAGE_KEY,
    );
  expect(await read()).toMatchObject({
    speedCopy: [first.id, null, null],
    prompts: [{ ...first, tags: [...first.tags, '!'] }, second],
  });

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 440, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup
    .getByRole('combobox', { name: 'Filter by tag' })
    .selectOption('!');
  await expect(popup.getByRole('article')).toHaveCount(1);
  await expect(
    popup.getByRole('article', { name: first.title, exact: true }),
  ).toBeVisible();
  await popup.getByRole('combobox', { name: 'Filter by tag' }).selectOption('');
  const copy = popup.getByRole('button', {
    name: `Speed-copy 1: ${first.title}`,
    exact: true,
  });
  await expect(copy).toBeEnabled();
  await copy.click();
  await expect(popup.getByRole('status')).toContainText('Copied');
  await context.grantPermissions(['clipboard-read']);
  expect(await popup.evaluate(() => navigator.clipboard.readText())).toBe(
    first.content,
  );
  await expect(
    popup.getByRole('button', {
      name: 'Speed-copy 2 (unassigned)',
      exact: true,
    }),
  ).toBeDisabled();
  const boxes = await popup
    .locator('.speed-copy-buttons button, .open-library')
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().x),
    );
  expect(boxes).toHaveLength(4);
  expect(boxes).toEqual([...boxes].sort((a, b) => a - b));
  expect(
    await popup.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(440);

  await popup
    .getByRole('button', { name: `Edit ${second.title}`, exact: true })
    .click();
  await popup
    .getByRole('combobox', { name: 'Speed-copy', exact: true })
    .selectOption('1');
  await popup.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(
    popup.getByRole('button', {
      name: `Speed-copy 1: ${second.title}`,
      exact: true,
    }),
  ).toBeEnabled();
  expect(await read()).toMatchObject({
    speedCopy: [second.id, null, null],
    prompts: [first, { ...second, tags: [...second.tags, '!'] }],
  });
  await popup.reload();
  await expect(
    popup.getByRole('button', {
      name: `Speed-copy 1: ${second.title}`,
      exact: true,
    }),
  ).toBeEnabled();
  await popup
    .getByRole('button', { name: `Edit ${second.title}`, exact: true })
    .click();
  await expect(popup.getByRole('textbox', { name: 'Tags' })).toHaveValue(
    'another, work',
  );
  await popup
    .getByRole('combobox', { name: 'Speed-copy', exact: true })
    .selectOption('');
  await popup.getByRole('button', { name: 'Save prompt', exact: true }).click();
  await expect(
    popup.getByRole('button', {
      name: 'Speed-copy 1 (unassigned)',
      exact: true,
    }),
  ).toBeDisabled();
  expect(await read()).toMatchObject({
    speedCopy: [null, null, null],
    prompts: [first, second],
  });
  await expect(
    popup
      .getByRole('combobox', { name: 'Filter by tag' })
      .getByRole('option', { name: '! (1)', exact: true }),
  ).toHaveCount(0);
});

test('registers shortcuts and copies through the real offscreen page with the popup closed', async ({
  page,
  context,
  worker,
  extensionId,
}) => {
  const commands = await worker.evaluate(() => chrome.commands.getAll());
  const registered = commands.filter((command) =>
    command.name?.startsWith('speed-copy-'),
  );
  expect(registered).toHaveLength(3);
  if (process.platform === 'darwin')
    expect(registered.every((command) => command.shortcut)).toBe(true);
  await page.close();
  const raw = '  # Speed copy\n<script>literal</script>\n  ';
  // Exercise the packaged offscreen document, real clipboard permission, and
  // sender checks without opening any Prompt Library UI.
  const result = await worker.evaluate(async (text) => {
    await chrome.offscreen.createDocument({
      url: 'clipboard.html',
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: 'Verify shortcut clipboard behavior.',
    });
    try {
      return await chrome.runtime.sendMessage({ target: 'clipboard', text });
    } finally {
      await chrome.offscreen.closeDocument();
    }
  }, raw);
  expect(result).toEqual({ ok: true });
  expect(
    context.pages().filter((item) => item.url().includes(extensionId)),
  ).toHaveLength(0);
  const reader = await context.newPage();
  await reader.goto(`chrome-extension://${extensionId}/index.html`);
  await context.grantPermissions(['clipboard-read']);
  expect(await reader.evaluate(() => navigator.clipboard.readText())).toBe(raw);
});
