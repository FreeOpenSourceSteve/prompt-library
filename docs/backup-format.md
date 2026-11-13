# Backup format, version 1

Export creates a UTF-8 `.json` file containing every saved prompt, regardless of active filters. JSON is the transport format; each prompt's `content` is plain text. Newlines and quotes are escaped in the file and restored by import. Body text is not trimmed, interpreted, or reformatted.

```json
{
  "format": "prompt-library",
  "version": 1,
  "exportedAt": "2026-11-02T12:00:00.000Z",
  "prompts": [
    {
      "id": "53bc046c-a823-43e7-854b-18a864414c7c",
      "revision": 1,
      "title": "Clearer writing",
      "content": "Rewrite the following text for clarity.\n\nKeep the original meaning.",
      "tags": ["writing", "editing"],
      "createdAt": "2026-11-02T12:00:00.000Z",
      "updatedAt": "2026-11-02T12:00:00.000Z"
    }
  ]
}
```

IDs are UUIDs. Revisions are positive safe integers. Timestamps use canonical UTC ISO 8601 strings with milliseconds; `updatedAt` must not precede `createdAt`. Unknown properties are discarded.

Titles are required, trimmed, and limited to 160 characters. Content is required, must include non-whitespace text, and is limited to 100,000 characters. Tags are optional arrays of strings; at most 20 ordinary tags plus the `!` speed-copy marker are accepted, then normalized to lowercase and deduplicated. Tags may not contain commas or line breaks and are limited to 40 characters each.

Files must be at most 8 MiB and contain at most 2,000 prompts with unique IDs. An invalid record rejects the entire file; no partial import is written. Preview occurs before any changes are saved.

Import merges by ID. Existing IDs are always skipped, preserving saved edits. New IDs retain their imported text, ordinary tags, timestamps, and revision. The reserved `!` marker is derived from the assignments accepted by the import. A second import of the same file adds no duplicates. A prompt deleted after backup is restored when its ID is absent. New duplicate prompts created in the UI receive a new ID, new timestamps, revision 1, and a ` (copy)` title suffix.

The stored document is `{ "schemaVersion": 1, "prompts": [...] }` under the `prompt-library` key. Backup and storage versions are explicit so future changes can introduce deliberate migrations instead of silently changing old data.

## Speed-copy assignments

Storage and backups optionally include `"speedCopy": ["<prompt UUID>", null, null]`. Entries correspond to buttons 1, 2, and 3. Older version-1 files without this field remain supported. Non-null IDs must be distinct and reference existing prompts. The `!` tag is added automatically for assigned IDs and removed from all unassigned prompts, even if a legacy file contains missing or stray markers. A marker is never a prerequisite for assignment. Assignment-only saves change only that tag on affected prompts; assignment mappings are stored outside prompt records.

Import restores assignments only for newly added prompts when the destination slot is free. It never changes existing prompts or replaces occupied slots. A prompt imported into an occupied slot retains its ordinary tags but is not assigned to that slot and does not receive `!`. Duplicating an assigned prompt copies its ordinary tags and text without giving the copy a marker or changing the slot’s assignment. The editor and create/update commands reject manually supplied standalone `!` tags; stored and imported records are reconciled programmatically against their assignments.
