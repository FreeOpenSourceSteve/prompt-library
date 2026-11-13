# Browser and operating system support

Each Manifest V3 target provides the same popup, full library, plain-text prompts, backup format, and local-only permissions. There are no operating system integrations or architecture-specific runtime binaries.

| Browser | macOS | Windows     | Linux       | Minimum browser | Build output    |
| ------- | ----- | ----------- | ----------- | --------------- | --------------- |
| Chrome  | Yes   | Yes         | Yes         | 120             | `dist`          |
| Firefox | Yes   | Yes         | Yes         | 140             | `build/firefox` |
| Safari  | Yes   | Unavailable | Unavailable | 17              | `build/safari`  |

Use an OS version supported by the browser itself. Safari is an Apple-platform browser; this implementation targets desktop macOS. Mobile interfaces and distribution are outside the current desktop scope.

## Build on any desktop OS

Install Node.js 24 LTS with npm, then run these commands in a terminal or PowerShell from the project directory:

```sh
npm ci
npm run build
npm run package
```

`build` creates all three targets. `package` rebuilds and creates these ZIPs under `release`:

- `prompt-library-chrome-0.1.1.zip`
- `prompt-library-firefox-0.1.1.zip`
- `prompt-library-safari-0.1.1.zip`

To build one target, use `npm run build:chrome`, `npm run build:firefox`, or `npm run build:safari`. Packaging uses JavaScript and portable file paths, without the system `zip` command, Bash, Xcode, or a Unix shell. `.gitattributes` keeps text line endings consistent across checkouts.

## Chrome

On macOS, Windows, or Linux, open `chrome://extensions`, enable Developer mode, choose Load unpacked, and select `dist`. Pin Prompt Library and click its toolbar icon.

Chrome's path remains `dist` to preserve the existing unpacked extension identity. Reload that extension to update it. Avoid moving its directory if you rely on Chrome's path-derived unpacked ID.

## Firefox

On macOS, Windows, or Linux, run `npm run build:firefox`, open `about:debugging#/runtime/this-firefox`, choose Load Temporary Add-on, and select `build/firefox/manifest.json`. Open the toolbar popup; use Open full library for the larger workspace.

Firefox removes temporary add-ons when it restarts. Normal release/beta Firefox requires Mozilla signing for permanent installation. Submit the Firefox ZIP through Mozilla Add-ons for listed or unlisted signing before distributing it for regular use. This project does not sign or publish automatically.

The target has a stable development ID in `config/targets.ts`, a Firefox 140 minimum, and an explicit declaration of no data collection. Choose your permanent unique add-on identity before the first public submission, then keep it stable. Firefox uses a module background event page because it does not implement extension background service workers.

## Safari

Current macOS Safari can load an extension folder temporarily without Xcode:

1. Run `npm run build:safari`.
2. In Safari > Settings > Advanced, enable Show features for web developers.
3. Open the Developer settings tab and choose Add Temporary Extension.
4. Allow the unsigned development extension when Safari asks, then select `build/safari` or its ZIP.
5. Enable Prompt Library in Extensions and open its toolbar popup.

Safari removes temporary extensions when you quit it or after its temporary-install time limit. If this option is unavailable in an older Safari release, use an Xcode development app.

For distribution, Apple's Safari Web Extension Packager in App Store Connect accepts the Safari ZIP from a browser on any operating system. Apple Developer Program enrollment, signing, and Apple review are separate steps. The ZIP contains web extension resources; it is not a signed Safari application.

For a local Xcode project on macOS, install full Xcode, then run:

```sh
npm run safari:project
```

This creates `safari-project`, using the current `safari-web-extension-packager` or older `safari-web-extension-converter`, and selects macOS only. The generated project references the built resources, so rebuild Safari before building the app. Select your Apple signing team and permanent bundle identifier in Xcode. The default `local.promptlibrary` identifier is for local development. Pass an identifier with `node scripts/safari-project.mjs com.yourcompany.promptlibrary` after building.

No signing keys or Apple credentials belong in this repository. These commands do not upload or publish an extension.

## Development and verification

- `npm run dev`: watch and rebuild Chrome.
- `npm run dev:firefox`: watch and rebuild Firefox.
- `npm run dev:safari`: watch and rebuild Safari resources.
- `npm run check`: formatting, lint, unit/component tests, and verified builds for every target.
- `npm run test:e2e`: build all targets and run real Chromium extension tests. Install its engine first with `npx playwright install chromium`.
- `npm run test:firefox`: install the built Firefox extension temporarily into an isolated official Firefox profile and check UI, storage, clipboard, drafts, navigation, and backups. Selenium Manager finds or downloads Firefox and geckodriver, requiring network access on the first run. `FIREFOX_BINARY` can select an installed browser. The driver enables extension-page automation only in its temporary profile.
- `npm run test:webkit`: check the compiled UI in Playwright WebKit, using a simulated WebExtensions bridge backed by the real library service. Install the engine first with `npx playwright install webkit`.

WebKit checks do not install a native Safari extension and do not verify Safari signing, permissions, toolbar lifecycle, or native storage. Complete the Safari checks in `docs/releasing.md` before calling a Safari release verified.

CI is configured for builds, tests, packaging, and real Chromium/Firefox checks on Ubuntu, Windows, and macOS, with WebKit UI checks on Ubuntu. This configuration does not mean those remote runs have already passed. Native Safari QA remains manual.

## Data and privacy

Each browser profile has its own library and session draft. Export JSON in one browser and import it into another to transfer prompts and tags; there is no automatic synchronization. Every target requests `storage` and `clipboardWrite`; Chrome additionally requests `offscreen` for shortcut copying. No target includes website permissions or content scripts, and all block external connections. Speed-copy shortcuts default to Command + Control + Z / X / C on macOS; other operating systems can configure the commands in their browser’s shortcut settings. Native shortcut registration, conflicts, clipboard access with the popup closed, and worker wake-up must be verified in each browser.

## Primary references

- [Mozilla cross-browser guidance](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Build_a_cross_browser_extension)
- [Background implementations](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [Firefox temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
- [Firefox signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Firefox data collection declarations](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [Running a Safari extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
- [Safari packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)
- [Safari packaging with App Store Connect](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)
