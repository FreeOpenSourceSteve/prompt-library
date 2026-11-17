# Prompt components development plan

## Product and metadata decisions

Version 2 keeps a prompt's `content` as either a plain-text string or an ordered array of typed references: `{ type: 'component' | 'prompt', id: UUID }`. A separate library-level `components` collection stores reusable `{ id, name, content, revision, createdAt, updatedAt }` records. This avoids copying shared text into every prompt and allows complete prompts, including composed prompts, to be reused.

References are live: editing shared text changes the composed output everywhere it is used. Names of components must be unique after NFC normalization, trimming, and case folding, and must differ from every prompt title. Existing duplicate prompt titles remain supported. IDs, rather than names, maintain references through renames.

Copy recursively expands references in order and places exactly one blank line between text values. Only boundary line breaks are removed for composed output; plain-text prompts and stored component bodies retain their original text. Labels are metadata and are not copied.

## Implementation sequence

1. **Domain standard and migration.** Add version-2 types, runtime validation, explicit version-1 storage/backup migration, graph validation, and one shared content resolver. Reject dangling references, cycles, excessive nesting, and oversized expanded prompts. Use indexed lookup and memoization per library snapshot.
2. **Atomic persistence.** Extend the serialized background service to create a prompt and its new components in one write. Add component create/update/delete commands with revision checks. Validate the resulting graph, names, counts, and bytes before persistence. Reject deletion while an item is referenced. Merge backups by ID and reject name/graph conflicts atomically.
3. **Shared composer.** Extend the existing modal/popup editor with plain-text and component modes, named new text, searchable existing components/prompts, ordering/removal, and a full-text preview. Preserve unfinished component drafts in session storage. Add component management to the full library.
4. **Consistent consumption.** Use the resolver for cards, popup details, body search, copy buttons, speed-copy buttons, and background shortcuts. Include components in version-2 backup export/import and preview counts.
5. **Verification and documentation.** Cover migration, composition, shared edits, cycles, namespace conflicts, stale writes, deletion, import atomicity, draft recovery, and real-extension create/reuse/copy behavior. Run formatting, lint, unit/component tests, all-browser builds, and Chromium integration tests. Update format and user documentation.

## Scale and acceptance boundaries

- Retain the local-only, single-writer architecture and existing 8 MiB storage/backup budget.
- Limit libraries to 2,000 prompts and 4,000 components; limit each composition to 100 references, depth to 32, and expanded prompt output to 100,000 characters. Check length before constructing oversized joined strings.
- Keep UI rendering, copy, and persistence on the same resolver; memoize compact graph nodes once per snapshot, cap full-text caching at one million characters, render 1,000-character card previews, and avoid persisting derived content.
- Preserve legacy prompt text, IDs, revisions, timestamps, tags, and speed-copy assignments during migration. Never overwrite unknown future schemas.
- Support all-new, all-existing, and mixed compositions; complete prompt references; keyboard-accessible reordering; consistent copy separators; useful errors with drafts retained.
- Future extensions can add reference types through the discriminated union, or replace the storage adapter with IndexedDB without moving domain logic into UI code.

## Implementation and verification status

All five implementation stages are complete. Domain validation uses compact shared graph nodes rather than materializing every assembled prompt. Unit/component coverage includes a 2,000-prompt shared graph, boundary text preservation, migration, live shared edits, atomic failure recovery, namespace conflicts, cyclic/dangling references, depth/length limits, import merges, and draft restoration. Real-extension tests cover all-new, all-existing, and mixed composition, nested prompt reuse, ordering, component management, both copy surfaces, speed-copy buttons, and session recovery.

Validation after the component editing follow-up: 110 unit/component tests pass; coverage thresholds pass (97.69% line coverage); formatting/lint/type checking and all three browser builds pass. All 11 selected Chromium regression tests pass, including create/edit inline component updates, independent text visibility, preview styling, tag search/filtering, and draft recovery. The previously identified macOS shortcut-binding test is excluded from this run because headless Chromium reported an unassigned suggested shortcut in the prior full-suite run. Shortcut manifest mappings are unchanged and their tests pass. The 0.2.0 packaging pass additionally verified an isolated native Firefox smoke test and the WebKit rendering check. Physical OS shortcut activation and native Safari execution remain outside these automated checks. See the release record in `docs/releasing.md`.

## Component editing and organization follow-up

The shared composer now supports staged inline edits to saved component names, text, and tags. A validated update batch carries original revisions through the serialized writer, making parent saves atomic. Repeated references share one edit; preview expansion includes nested references. Closing/discarding does not mutate shared records. Each part shows its text by default with a hide/show button, and the preview label and shaded monospace text area match the form design. Tags are available in new component fields, inline editing, and component management, with tag-aware picker search and management filters. Missing tags in existing version-2 records default to empty arrays. Draft recovery preserves component edits and their original revisions.
