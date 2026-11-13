# Changelog

## Unreleased

- Add separate Chrome, Firefox, and Safari Manifest V3 builds, with shared native API access.
- Support desktop Chrome and Firefox on macOS, Windows, and Linux; prepare Safari resources and packaging for macOS.
- Replace the system ZIP utility with portable, reproducible JavaScript packaging.
- Add real Firefox extension tests, WebKit rendering checks, and a three-OS CI matrix.

- Open a toolbar popup for everyday viewing, search, tag filtering, copying, adding, and editing prompts.
- Open the full library from the popup for backup tools and library management.
- Recover unfinished popup drafts during the current Chrome session and preserve edit conflict protection across both views.
- Share editor and clipboard behavior between the popup and full page; retain storage-only permissions.

## 0.1.0 — 2026-11-02

- Initial local-only Manifest V3 extension foundation.
- Plain-text prompt editing, copying, duplication, deletion, tags, search, and sorting.
- Versioned JSON backup export and previewed merge import.
- Serialized writes, cross-tab updates, revision conflict protection, and data validation.
- Strict TypeScript, linting, formatting, unit/component tests, extension browser tests, and CI.
