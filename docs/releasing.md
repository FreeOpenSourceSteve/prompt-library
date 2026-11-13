# Release checklist

1. Update `package.json` and `config/manifest.base.json` to the same version; run `npm install --package-lock-only` to sync the lockfile.
2. Run `npm ci`, `npm run check`, and `npm run test:coverage`.
3. Install Playwright's Chromium and WebKit engines if needed. Run `npm run test:e2e`, `npm run test:firefox`, and `npm run test:webkit`.
4. Review `npm audit` and `npm audit --omit=dev`; evaluate findings rather than applying breaking forced upgrades blindly.
5. Load the production `dist` folder in current Chrome on each desktop OS. Also load `build/firefox` in Firefox and `build/safari` in native macOS Safari using the [browser setup guide](browser-support.md). Click the pinned toolbar icon, verify the popup opens, and check the extension error panel. Search, expand, copy, add, edit, and filter prompts in the popup. Use **Open full library** and verify the main page opens with the same saved prompts.
6. Manually save, edit, duplicate, copy, tag, search, filter, sort, and delete prompts, including literal HTML, Markdown, Unicode, and multiline whitespace.
7. Verify speed-copy assignment, replacement, unassignment, all three macOS shortcuts with the popup closed, worker wake-up, and clipboard permission errors in each native browser. Confirm assignment-only saves preserve metadata and other tags.
8. Verify keyboard navigation, modal focus/Escape behavior, cancellation, reduced motion, and layout at narrow and wide widths. Check permission-denied clipboard behavior and storage failure messages.
9. Export a backup, restore into a separate empty test profile, and compare exact body text and metadata. Import malformed, unsupported-version, and duplicate-ID files; verify saved data is preserved.
10. Test profile persistence across browser restarts and background suspension, and test conflicting edits between the popup and full page. Close the popup by clicking outside it during an edit and reopen it to verify draft recovery. Save or discard the draft and check that it is cleared. Session drafts should not survive browser restarts or extension reloads. Avoid testing destructive profile changes with your only copy of real data.
11. Run `npm run package`. Each browser ZIP must contain `manifest.json` at its root, with no source, dependencies, tests, credentials, or source maps.
12. If publishing, prepare store assets, privacy disclosures, support details, and an appropriate source license. No store publishing is automated.

Complete native Safari testing before releasing its target. WebKit rendering checks simulate the extension APIs and cannot verify native Safari storage, popup lifecycle, permissions, or signing. Validate the generated app or temporary extension in Safari itself, review any packager warnings, and use Apple signing/TestFlight/App Store distribution as appropriate. Check Mozilla signing separately for permanent Firefox installation.
