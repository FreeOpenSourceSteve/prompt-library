import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Builder, By, until } from 'selenium-webdriver';
import firefoxDriver from 'selenium-webdriver/firefox.js';
import { FIREFOX_ID } from '../../config/targets.ts';

// Selenium temporarily installs the real Firefox build into an isolated profile.
// Selenium Manager finds/downloads official Firefox and geckodriver as needed.
const uuid = '5fe484e9-1ecd-47a9-b128-59ead72f306a';
const downloads = await realpath(
  await mkdtemp(join(tmpdir(), 'prompt-firefox-downloads-')),
);
const options = new firefoxDriver.Options()
  .setBrowserVersion('stable')
  .addArguments('-headless')
  .setPreference(
    'extensions.webextensions.uuids',
    JSON.stringify({ [FIREFOX_ID]: uuid }),
  )
  .setPreference('browser.download.folderList', 2)
  .setPreference('browser.download.dir', downloads)
  .setPreference('browser.helperApps.neverAsk.saveToDisk', 'application/json')
  .setPreference('browser.download.alwaysOpenPanel', false);
if (process.env.FIREFOX_BINARY) options.setBinary(process.env.FIREFOX_BINARY);
const driver = await new Builder()
  .forBrowser('firefox')
  .setFirefoxOptions(options)
  .setFirefoxService(
    new firefoxDriver.ServiceBuilder()
      // Required by modern Firefox to automate moz-extension pages. This
      // service controls only the fresh, temporary test profile.
      .addArguments('--allow-system-access', '--profile-root', downloads),
  )
  .build();
await driver.manage().setTimeouts({ script: 15_000, pageLoad: 30_000 });

async function visible(selector) {
  const element = await driver.wait(
    until.elementLocated(By.css(selector)),
    15_000,
  );
  await driver.wait(until.elementIsVisible(element), 15_000);
  return element;
}
async function button(text) {
  const element = await driver.wait(
    until.elementLocated(By.xpath(`//button[normalize-space()="${text}"]`)),
    15_000,
  );
  await driver.wait(until.elementIsEnabled(element), 15_000);
  return element;
}
async function fill(selector, value) {
  const element = await visible(selector);
  await element.clear();
  await element.sendKeys(value);
}
const raw =
  '  # Literal prompt\n<script>window.injected = true</script>\n**Keep this plain**  ';
try {
  await driver.installWebExtension(resolve('build/firefox'), {
    permanent: false,
  });
  await driver.get(`moz-extension://${uuid}/popup.html`);
  await (await button('New prompt')).click();
  await fill('input[name="title"]', 'Firefox daily prompt');
  await fill('textarea[name="content"]', raw);
  await fill('input[name="tags"]', 'writing, work');
  await (await button('Save prompt')).click();
  const card = await visible('article[aria-label="Firefox daily prompt"]');
  await card.findElement(By.css('summary')).click();
  const text = await visible('.popup-full-text');
  assert.equal(await text.getAttribute('textContent'), raw);
  assert.equal(
    await driver.executeScript('return "injected" in window'),
    false,
  );
  await (await button('Copy')).click();
  await driver.wait(
    async () =>
      (await visible('[role="status"]'))
        .getText()
        .then((text) => text.includes('Copied')),
    10_000,
  );
  // Verify Copy succeeds with normal permissions first. Enable clipboard
  // readback only afterward in this isolated test profile.
  await driver.setContext(firefoxDriver.Context.CHROME);
  await driver.executeScript(
    'Services.prefs.setBoolPref("dom.events.testing.asyncClipboard", true);',
  );
  await driver.setContext(firefoxDriver.Context.CONTENT);
  const copied = await driver.executeAsyncScript(
    'navigator.clipboard.readText().then(arguments[arguments.length - 1]);',
  );
  assert.equal(copied, raw);
  await fill('input[type="search"]', 'unmatched query');
  await driver.wait(
    async () =>
      (await visible('.popup-empty'))
        .getText()
        .then((text) => text.includes('No prompts found')),
    10_000,
  );
  await (await button('Clear filters')).click();
  await (
    await visible('button[aria-label="Edit Firefox daily prompt"]')
  ).click();
  await fill('input[name="title"]', 'Edited in Firefox');
  // Refresh the popup document to verify the session draft and original revision survive.
  await driver.wait(
    async () =>
      driver
        .executeAsyncScript(
          'browser.storage.session.get("popup-editor-draft").then(data => arguments[arguments.length - 1](data["popup-editor-draft"]?.fields.title));',
        )
        .then((title) => title === 'Edited in Firefox'),
    10_000,
  );
  await driver.navigate().refresh();
  assert.equal(
    await (await visible('input[name="title"]')).getAttribute('value'),
    'Edited in Firefox',
  );
  await (await button('Save prompt')).click();
  await visible('article[aria-label="Edited in Firefox"]');
  const handles = await driver.getAllWindowHandles();
  await (await visible('button[aria-label="Open full library"]')).click();
  const newHandle = await driver.wait(
    async () =>
      (await driver.getAllWindowHandles()).find(
        (handle) => !handles.includes(handle),
      ),
    10_000,
  );
  await driver.switchTo().window(newHandle);
  await visible('article[aria-label="Edited in Firefox"]');
  await (await button('Export all')).click();
  const file = await driver.wait(
    async () =>
      (await readdir(downloads)).find((name) => name.endsWith('.json')),
    15_000,
  );
  const exported = JSON.parse(await readFile(join(downloads, file), 'utf8'));
  assert.equal(exported.prompts[0].content, raw);
  assert.equal(exported.prompts[0].title, 'Edited in Firefox');
  await (await visible('input[type="file"]')).sendKeys(join(downloads, file));
  const importButton = await visible('dialog button.primary');
  assert.equal(await importButton.getText(), 'Import 0 prompts');
  assert.equal(await importButton.isEnabled(), false);
  await (await button('Cancel')).click();
  await (
    await visible('button[aria-label="Duplicate Edited in Firefox"]')
  ).click();
  await visible('article[aria-label="Edited in Firefox (copy)"]');
  await (
    await visible('button[aria-label="Delete Edited in Firefox (copy)"]')
  ).click();
  await (await button('Delete prompt')).click();
  await driver.wait(
    async () => (await driver.findElements(By.css('article'))).length === 1,
    10_000,
  );
  console.log(
    'Firefox extension passed: popup, plain text, clipboard, search, edits, session drafts, full library, export/import, duplicate, delete.',
  );
} finally {
  await driver.quit();
  await rm(downloads, { recursive: true, force: true });
}
