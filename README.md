# Prompt Library

A browser extension for keeping useful AI prompts in one private, local library. Supports Chrome and Firefox on macOS, Windows, and Linux, plus Safari on macOS. Built with Manifest V3, React, TypeScript, and Vite. Click the toolbar icon for a quick-access popup, or use **Open full library** in the popup to open the main extension page.

## What works

- Create, edit, duplicate, and delete prompts.
- Copy the full prompt with one click.
- Assign prompts to speed-copy buttons **1**, **2**, and **3** in the popup header, or copy using macOS shortcuts while the popup is closed.
- Add normalized tags and filter by tag.
- Search titles, prompt text, and tags; sort by date or title.
- Export the complete library to a versioned JSON backup.
- Preview and import the same backup format without replacing existing prompts.
- Keep multiple library tabs in sync and detect conflicting edits.
- View full plain-text prompts, search, filter, add, edit, and copy directly from the popup.
- Recover an unfinished popup draft if you click away, during the current browser session.

The popup handles everyday prompt use. The full library provides the larger workspace, backup import/export, duplication, and deletion. Both surfaces share the same saved prompts and conflict checks. No account is required.

Prompts are **plain text**. Markdown, HTML, whitespace, and line breaks remain literal text when stored, edited, copied, and exported. Card previews are shortened visually; Edit shows the complete text. The JSON backup preserves tags and metadata alongside the plain-text content; it is not a Markdown document or a `.txt` export.

## Speed-copy

Open a prompt’s editor in the popup or full library, choose **Speed-copy → 1, 2, or 3**, then click **Save prompt**. Choose **Unassigned** and save to remove it. Assigning an occupied number replaces its previous prompt; choosing another number moves the prompt there. Empty buttons are disabled.

| Button | macOS shortcut        |
| ------ | --------------------- |
| 1      | Command + Control + Z |
| 2      | Command + Control + X |
| 3      | Command + Control + C |

Shortcuts copy the complete saved prompt body while the browser is focused, with the popup closed. Other operating systems can assign shortcuts in their browser’s extension shortcut settings. In Chrome, check `chrome://extensions/shortcuts` if a binding conflicts with another extension. A failed shortcut shows **!** on the extension icon; hover over it for details.

Assignment-only saves add or remove the `!` tag and preserve the prompt’s title, content, other tags, revision, and timestamps. The standalone `!` tag is reserved for speed-copy. It is shown read-only in the editor and cannot be entered in Tags; tags such as `important!` remain allowed. Filter by `!` to see only currently assigned prompts. The marker does not count toward the 20 ordinary-tag limit. Existing missing or stray markers are corrected automatically on load without changing other tags or metadata. Assignments persist across browser restarts and are included in JSON backups. Import restores assignments for newly imported prompts into free slots; existing slots and prompts are preserved.

## Get started with Chrome

Use **Node.js 24 LTS** and npm on macOS, Windows, or Linux. If you use nvm, run `nvm install` and `nvm use` in this directory.

```sh
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked**, then select this project's **dist** folder.
4. Pin **Prompt Library** using Chrome's Extensions menu.
5. Click the toolbar icon and save your first prompt in the popup. Select **Open full library** in the popup header for the main page.

The steps above install Chrome's build. Load `dist`, not the project root or `public`. For Firefox, load `build/firefox/manifest.json` through `about:debugging`. For Safari, use `build/safari` with temporary installation in current Safari or Apple's packager. See the [browser and OS setup guide](docs/browser-support.md) for installation, signing, and verification limits. Minimum targets: Chrome 120, Firefox 140, Safari 17. An empty library on first use is expected.

## Development

```sh
npm run dev
```

This watches source files and rebuilds Chrome's `dist`. Use `npm run dev:firefox` or `npm run dev:safari` for the other targets. After changes, click the extension's reload button at `chrome://extensions`, then reload any open library tabs. Vite's HTTP development server and HMR are intentionally not used: development uses the real extension origin and the same strict security policy as production.

If opening `index.html` outside the extension, the page explains how to load the extension. There is no browser-local storage fallback that could hide extension integration problems.

| Command                           | Purpose                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run check`                   | Formatting, lint, unit/component tests, type checking, production build, and manifest checks |
| `npm run test:watch`              | Watch unit/component tests                                                                   |
| `npm run test:coverage`           | Data-layer coverage with enforced thresholds                                                 |
| `npx playwright install chromium` | Install the isolated browser used for end-to-end tests                                       |
| `npm run test:e2e`                | Build and test the actual extension in Chromium                                              |
| `npm run format`                  | Format source and documentation                                                              |
| `npm run package`                 | Build and create separate Chrome, Firefox, and Safari ZIPs under `release`                   |
| `node scripts/generate-icons.mjs` | Regenerate the packaged icon sizes                                                           |

Build and packaging scripts work on macOS, Windows, and Linux without a system `zip` command. Safari distribution uses Apple's separate packaging and signing process. `package-lock.json` pins the dependency tree; use `npm ci` for repeatable installs.

Builds include the required third-party license notices. CI actions are pinned to verified release commits, with Dependabot configured to propose dependency updates after the project is hosted on GitHub.

## Project layout

```text
config/                  Shared manifest source and per-browser targets
public/                  Bundled PNG icons and third-party notices
src/
  app/                   App shell, shared UI, library subscription, styles
  background/            MV3 entry point and serialized library operations
  domain/                Models, validation, search, sort, backup format
  features/
    backups/             Import preview
    prompts/             Cards, editor, delete confirmation
  platform/              Browser API adapter, messaging/storage subscription and local file I/O
  popup/                 Quick-access UI and temporary draft recovery
tests/                   Shared fixtures and real-extension browser tests
scripts/                 Build verification, packaging, icon generation
docs/                    Architecture, data format, privacy, release checks
.github/workflows/       Continuous integration
```

Read [architecture](docs/architecture.md), [backup format](docs/backup-format.md), [privacy](docs/privacy.md), and [contributing](CONTRIBUTING.md) before extending the app.

## Storage and backups

The library lives in WebExtensions local storage, within the current browser profile. Export/import transfers prompts between browsers and operating systems; there is no automatic synchronization. The extension requests `storage` and `clipboardWrite`; Chrome also requests `offscreen` so shortcuts can copy through a hidden clipboard document while the popup is closed. There are no content scripts, website permissions, accounts, analytics, external requests, or remote dependencies at runtime. Copying follows an explicit click or keyboard shortcut, and the extension never reads the clipboard. Downloads and uploads use the browser's standard local file controls.

An unfinished popup draft is held in WebExtensions session storage and restored when the popup reopens. It retains the original prompt revision to detect edits made from the full page. Saving or explicitly discarding the draft clears it. Session drafts are temporary and are cleared when the browser restarts or the extension reloads; click **Save prompt** for permanent storage.

Limits: 2,000 prompts; 160 characters per title; 100,000 per prompt body; 20 tags per prompt, 40 characters per tag; approximately 8 MB total serialized data. Import files must be at most 8 MiB. Quota checks leave room for a backup envelope.

**Export backups regularly.** Uninstalling the extension or deleting the browser profile removes its local data. Storage and exported files are not application-encrypted; treat them as private documents. See the [privacy note](docs/privacy.md).

Import adds new IDs, skips existing IDs, and never replaces saved prompts, even when an imported record is newer. Import is all-or-nothing after validation and quota checks. It is suitable for restoring into an empty library or adding missing prompts, rather than rolling existing records back to an older backup.

## Before distribution

This is a working development foundation, not a published browser store listing. Follow the [release checklist](docs/releasing.md), choose an appropriate license before distributing source, and prepare store screenshots and listing/privacy text separately. No license or public publication is assumed.
