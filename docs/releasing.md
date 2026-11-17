# Release checklist

1. Choose a version for the accumulated changes. Run `npm version <version> --no-git-tag-version --ignore-scripts` to synchronize `package.json` and both root version fields in `package-lock.json`; set the same application version in `config/manifest.base.json`. Update `CHANGELOG.md` with the release date, features, and migration notes, and update the package filenames in `docs/browser-support.md`. Storage/backup schema versions are independent of the application version.
2. Run `npm ci`, `npm run check`, and `npm run test:coverage`.
3. Install Playwright's Chromium and WebKit engines if needed. Run `npm run test:e2e`, `npm run test:firefox`, and `npm run test:webkit`.
4. Review `npm audit` and `npm audit --omit=dev`; evaluate findings rather than applying breaking forced upgrades blindly.
5. Load the production `dist` folder in current Chrome on each desktop OS. Also load `build/firefox` in Firefox and `build/safari` in native macOS Safari using the [browser setup guide](browser-support.md). Click the pinned toolbar icon, verify the popup opens, and check the extension error panel. Search, expand, copy, add, edit, and filter prompts in the popup. Use **Open full library** and verify the main page opens with the same saved prompts.
6. Manually save, edit, duplicate, copy, tag, search, filter, sort, and delete prompts, including literal HTML, Markdown, Unicode, and multiline whitespace.
7. Verify speed-copy assignment, replacement, unassignment, all three macOS shortcuts with the popup closed, worker wake-up, and clipboard permission errors in each native browser. Confirm assignment-only saves preserve metadata and other tags.
8. Verify keyboard navigation, modal focus/Escape behavior, cancellation, reduced motion, and layout at narrow and wide widths. Check permission-denied clipboard behavior and storage failure messages.
9. Export a backup, restore into a separate empty test profile, and compare exact body text and metadata. Import malformed, unsupported-version, and duplicate-ID files; verify saved data is preserved.
10. Test profile persistence across browser restarts and background suspension, and test conflicting edits between the popup and full page. Close the popup by clicking outside it during an edit and reopen it to verify draft recovery. Save or discard the draft and check that it is cleared. Session drafts should not survive browser restarts or extension reloads. Avoid testing destructive profile changes with your only copy of real data.
11. Run `npm run package`. Verify each ZIP matches its fresh build directory byte for byte and has the expected manifest version at its root, with no source, dependencies, tests, credentials, or source maps. Record SHA-256 checksums alongside the versioned packages. Keep older versioned packages intact.
12. If publishing, prepare store assets, privacy disclosures, support details, and an appropriate source license. No store publishing is automated.

Complete native Safari testing before releasing its target. WebKit rendering checks simulate the extension APIs and cannot verify native Safari storage, popup lifecycle, permissions, or signing. Validate the generated app or temporary extension in Safari itself, review any packager warnings, and use Apple signing/TestFlight/App Store distribution as appropriate. Check Mozilla signing separately for permanent Firefox installation.

## 0.2.0 packaging record — 2026-11-17

Version 0.2.0 is a minor application release for the reusable-component workflow, inline shared editing, component tags, and version-2 metadata. The storage/backup schema remains 2. Both package/lockfile root versions, the source manifest, and all generated browser manifests use application version 0.2.0. The changelog separates the component release from features already present in the archived 0.1.1 builds.

All three packages were built from the current source, and their extracted members were verified byte for byte against their production build directories. Each contains the expected 0.2.0 root manifest and latest component UI/save paths, with no source maps or development source/dependency folders. The six older versioned ZIPs remain unchanged. Checksums are recorded in `release/SHA256SUMS-0.2.0.txt`.

Validation completed:

- `npm run check`: formatting, lint, 110 unit/component tests, type checking, all three production builds, and manifest checks passed.
- Chromium extension regressions: all 11 selected tests passed using `--grep-invert 'registers shortcuts'`.
- `npm run test:firefox`: the isolated native Firefox smoke test passed, including popup, literal text, clipboard, session drafts, navigation, backups, duplication, and deletion.
- `npm run test:webkit`: the compiled-UI rendering check passed with a simulated WebExtensions bridge.

The previously identified macOS shortcut-binding test was excluded; physical OS shortcut activation remains a native-browser check. Native Safari installation/signing and manual verification on other desktop operating systems have not been established by these automated checks. The Safari ZIP contains web-extension resources, not a signed application. These packages have not been uploaded to browser stores.
