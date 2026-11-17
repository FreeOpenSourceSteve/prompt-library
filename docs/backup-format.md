# Backup format, version 2

Export creates a UTF-8 JSON file containing all prompts, reusable components, and speed-copy assignments, regardless of active filters. Storage uses `{ "schemaVersion": 2, "prompts": [...], "components": [...] }` under the `prompt-library` key. Backups replace `schemaVersion` with the envelope fields below.

```json
{
  "format": "prompt-library",
  "version": 2,
  "exportedAt": "2026-11-16T12:00:00.000Z",
  "components": [
    {
      "id": "cf4dfcfa-47ea-4e64-a340-302f6f5637b5",
      "revision": 1,
      "name": "NCLEX tutor role",
      "tags": ["nursing", "role"],
      "content": "Role: You are an NCLEX-RN tutor and study assistant.",
      "createdAt": "2026-11-16T12:00:00.000Z",
      "updatedAt": "2026-11-16T12:00:00.000Z"
    }
  ],
  "prompts": [
    {
      "id": "53bc046c-a823-43e7-854b-18a864414c7c",
      "revision": 1,
      "title": "Create exam preparation material",
      "content": [
        { "type": "component", "id": "cf4dfcfa-47ea-4e64-a340-302f6f5637b5" },
        { "type": "prompt", "id": "7d409b83-2570-4451-87c1-8f55a881c23b" }
      ],
      "tags": ["nursing"],
      "createdAt": "2026-11-16T12:00:00.000Z",
      "updatedAt": "2026-11-16T12:00:00.000Z"
    },
    {
      "id": "7d409b83-2570-4451-87c1-8f55a881c23b",
      "revision": 1,
      "title": "Exam preparation task",
      "content": "Task: Create concise, nursing-focused exam preparation material.",
      "tags": [],
      "createdAt": "2026-11-16T12:00:00.000Z",
      "updatedAt": "2026-11-16T12:00:00.000Z"
    }
  ],
  "speedCopy": ["53bc046c-a823-43e7-854b-18a864414c7c", null, null]
}
```

## Content and identity

Prompt `content` is a nonempty plain-text string or an ordered array of 1–100 references. Reference `type` is `component` or `prompt`; `id` identifies the saved record. Complete prompts can contain references themselves. All references must resolve within the library; cycles are forbidden. Repeated references are allowed and repeat their text. Nesting is limited to 32 levels. The expanded result must not exceed 100,000 characters.

Component `content` is nonempty plain text up to 100,000 characters. Text is stored verbatim, including quotes, markup, and whitespace. Plain-text prompts copy verbatim. Composed copies recursively expand references, remove boundary line breaks and whitespace-only boundary lines, and join text values with `\n\n`. Internal whitespace remains intact. Names and labels are never copied.

References are live: changing shared text changes all assemblies that use it. Parent revisions describe their own title, reference order, and tags, and do not change on shared edits. Removing a reference leaves its source available. Deleting a referenced record is rejected.

IDs are UUIDs and unique across both collections. Revisions are positive safe integers. Timestamps use canonical UTC ISO 8601 strings with milliseconds; `updatedAt` must not precede `createdAt`. Unknown properties are discarded. Titles and names are required, trimmed, and limited to 160 characters. Component names cannot contain line breaks. Component names are NFC-normalized and must be unique after trimming and case folding, and must differ from every prompt title. Duplicate prompt titles remain supported for legacy compatibility.

Tags are arrays of strings, with at most 20 ordinary tags plus the `!` marker. They are NFC-normalized, lowercased, trimmed, and deduplicated. Each tag is at most 40 characters and cannot contain commas or line breaks. The `!` marker is derived from speed-copy assignments rather than authored manually. Components also have a `tags` array with the same normalization, length, and 20-tag limits, but cannot use the reserved `!` marker. Component tags organize source text independently of prompt tags and are never copied. Earlier version-2 component records without `tags` parse as an empty array; new exports always include the field. This additive field does not require a schema version change.

## Migration and import

Version-1 libraries and backups remain supported. Their prompts must have string content. Migration adds an empty component collection and changes the version to 2, preserving text, IDs, revisions, timestamps, ordinary tags, and assignments. Existing missing/stray speed-copy markers are reconciled as before. The background persists the storage migration once after validation; a failed write leaves the version-1 data intact. Future versions fail without overwriting data. Version-2 exports require a version-2-capable extension.

Files must be at most 8 MiB and contain at most 2,000 prompts and 4,000 components. The serialized storage limit reserves space for the backup envelope. Inline shared-component edits include original revisions and are saved atomically with their parent prompt; stale revisions, invalid tags, or invalid resulting assemblies reject the entire save. Invalid data rejects the entire file; preview precedes any changes. Mutations and imports persist with one write after all checks pass.

Import merges both collections by ID. Existing IDs keep their current text and metadata; new IDs retain imported data. The resulting namespace, references, expanded output, counts, and storage bytes must all be valid. Conflicting names reject the entire import rather than silently renaming components. If a skipped source ID has different saved text, imported prompts use that saved text; an oversized merged assembly rejects the import. Component-only backups and imports are supported. Re-importing a backup adds no duplicates.

Duplicating a prompt creates a new prompt ID, revision 1, new timestamps, and a ` (copy)` title suffix. Its reference order remains intact and points to the same shared records. Components are not duplicated. If that generated title conflicts with a component name, a numbered copy suffix is used.

## Speed-copy assignments

The optional `speedCopy` tuple stores three prompt IDs or nulls, in button order. Non-null IDs must be distinct and identify saved prompts. Missing assignments remain supported. Parsing adds `!` for assigned IDs and removes it from unassigned prompts. Assignment-only saves preserve revisions, timestamps, text, and ordinary tags.

Import restores assignments only for new prompt IDs into free slots. Existing assignments are preserved. Duplication copies ordinary tags without assigning the duplicate. Every speed-copy path expands composed prompts with the same rules as the regular Copy button.
