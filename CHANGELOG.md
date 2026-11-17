# Changelog

## 0.2.0 — 2026-11-17

A minor release for the new prompt-component workflow and version-2 metadata. Existing version-1 libraries and backups migrate automatically; new exports use version 2 and require a compatible extension.

- Compose prompts from ordered reusable text components, complete prompts, or a mixture of new and saved content in the full library and popup.
- Edit saved component names, text, and tags inside create/edit prompt forms; save shared edits atomically with the parent prompt and preserve drafts on conflicts or failures.
- Show each part's source text by default with independent Hide/Show controls, keyboard-accessible ordering/removal, and a shaded monospace assembled preview with consistent labels.
- Manage shared components, search/filter component tags, enforce unique component names distinct from prompt titles, and protect referenced records from deletion.
- Expand components consistently in search, previews, copy buttons, and keyboard speed-copy, with exactly one blank line between text values.
- Preserve inline component edits, tags, and original revisions in popup session drafts; support undo and conversion to independent text.
- Include components, tags, references, and speed-copy assignments in versioned backup export and atomic merge import.
- Validate circular/dangling references, nesting depth, expanded text length, storage quotas, and concurrent updates. Use indexed graph resolution, bounded text caching, and short card previews to limit memory use.
- Add component domain, persistence, editor, and real-extension regression coverage.
- Load extension test browsers explicitly through DevTools and validate registered commands independently of desktop shortcut assignments, while retaining the full offscreen clipboard test.

## 0.1.1

- Add separate Chrome, Firefox, and Safari Manifest V3 builds, with shared native API access.
- Support desktop Chrome and Firefox on macOS, Windows, and Linux; prepare Safari resources and packaging for macOS.
- Replace the system ZIP utility with portable, reproducible JavaScript packaging.
- Add real Firefox extension tests, WebKit rendering checks, and a three-OS CI matrix.

- Assign prompts to speed-copy buttons and macOS keyboard shortcuts, with reserved tag handling, assignment conflict checks, and backup support.
- Open a toolbar popup for everyday viewing, search, tag filtering, copying, adding, and editing prompts.
- Open the full library from the popup for backup tools and library management.
- Recover unfinished popup drafts during the current browser session and preserve edit conflict protection across both views.
- Share editor and clipboard behavior between the popup and full page; retain local-only permissions.

## 0.1.0 — 2026-11-02

- Initial local-only Manifest V3 extension foundation.
- Plain-text prompt editing, copying, duplication, deletion, tags, search, and sorting.
- Versioned JSON backup export and previewed merge import.
- Serialized writes, cross-tab updates, revision conflict protection, and data validation.
- Strict TypeScript, linting, formatting, unit/component tests, extension browser tests, and CI.
