import {
  MAX_CONTENT_LENGTH,
  MAX_COMPONENTS,
  MAX_PARTS,
  MAX_FILE_BYTES,
  MAX_PROMPTS,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TITLE_LENGTH,
  SCHEMA_VERSION,
} from './models';
import { validateComposition } from './composition';
import { SPEED_COPY_TAG, syncSpeedCopyTags } from './speed-copy';
import type {
  Backup,
  Component,
  ComponentInput,
  ComponentUpdate,
  NewComponent,
  PromptContent,
  Library,
  Prompt,
  PromptInput,
  SpeedCopy,
  SpeedCopySlot,
} from './models';

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object.');
  }
  return value as Record<string, unknown>;
}

export function validateInput(value: unknown): PromptInput {
  const input = validatePromptInput(value);
  if (input.tags.includes(SPEED_COPY_TAG)) {
    throw new Error(
      'The ! tag is reserved for speed-copy. Choose a speed-copy number instead of entering ! in Tags.',
    );
  }
  return input;
}

// Stored records and old backups may contain the marker. Validate them first,
// then derive it from their assignments instead of requiring it beforehand.
function validatePromptInput(value: unknown): PromptInput {
  const input = record(value);
  if (
    typeof input.title !== 'string' ||
    !input.title.trim() ||
    input.title.trim().length > MAX_TITLE_LENGTH
  ) {
    throw new Error(
      `Add a title between 1 and ${MAX_TITLE_LENGTH} characters.`,
    );
  }
  const content = validateContent(input.content);
  return { title: input.title.trim(), content, tags: validateTags(input.tags) };
}

function validateTags(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.filter(
      (tag: unknown) => typeof tag !== 'string' || tag.trim() !== '!',
    ).length > MAX_TAGS ||
    value.length > MAX_TAGS + 1 ||
    value.some((tag: unknown) => typeof tag !== 'string')
  ) {
    throw new Error(`Use up to ${MAX_TAGS} text tags.`);
  }
  const tags = [
    ...new Set(
      (value as string[])
        .map((tag) => tag.normalize('NFC').trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (
    tags.some(
      (tag) =>
        tag.length > MAX_TAG_LENGTH || tag.includes(',') || /[\r\n]/u.test(tag),
    )
  ) {
    throw new Error(
      `Each tag must be at most ${MAX_TAG_LENGTH} characters, without commas or line breaks.`,
    );
  }
  return tags;
}

export function validateText(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > MAX_CONTENT_LENGTH
  )
    throw new Error(
      `Add prompt text between 1 and ${MAX_CONTENT_LENGTH.toLocaleString('en-US')} characters.`,
    );
  return value;
}

export function validateContent(value: unknown): PromptContent {
  if (typeof value === 'string') return validateText(value);
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PARTS)
    throw new Error(`Use between 1 and ${MAX_PARTS} components in a prompt.`);
  return value.map((value: unknown) => {
    const part = record(value);
    if (part.type !== 'component' && part.type !== 'prompt')
      throw new Error('Invalid component reference type.');
    return { type: part.type, id: validateId(part.id) };
  });
}

export function validateComponentInput(value: unknown): ComponentInput {
  const input = record(value);
  if (
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.normalize('NFC').trim().length > MAX_TITLE_LENGTH ||
    /[\r\n]/u.test(input.name)
  )
    throw new Error(
      `Add a component name between 1 and ${MAX_TITLE_LENGTH} characters, without line breaks.`,
    );
  const tags = validateTags(input.tags === undefined ? [] : input.tags);
  if (tags.includes(SPEED_COPY_TAG))
    throw new Error(
      'The ! tag is reserved for prompt speed-copy. Choose another component tag.',
    );
  return {
    tags,
    name: input.name.normalize('NFC').trim(),
    content: validateText(input.content),
  };
}

export function validateNewComponents(value: unknown): NewComponent[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PARTS)
    throw new Error(`Create up to ${MAX_PARTS} components at once.`);
  return value.map((item: unknown) => ({
    ...validateComponentInput(item),
    id: validateId(record(item).id),
  }));
}

export function validateComponentUpdates(value: unknown): ComponentUpdate[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PARTS)
    throw new Error(`Edit up to ${MAX_PARTS} components at once.`);
  const updates = value.map((value: unknown) => {
    const item = record(value);
    return {
      id: validateId(item.id),
      revision: validateRevision(item.revision),
      input: validateComponentInput(item.input),
    };
  });
  if (new Set(updates.map((item) => item.id)).size !== updates.length)
    throw new Error('Each component can only be updated once per save.');
  return updates;
}

export function validateComponent(value: unknown): Component {
  const item = record(value);
  const createdAt = validateDate(item.createdAt);
  const updatedAt = validateDate(item.updatedAt);
  if (updatedAt < createdAt)
    throw new Error('A component was updated before it was created.');
  return {
    ...validateComponentInput(item),
    id: validateId(item.id),
    revision: validateRevision(item.revision),
    createdAt,
    updatedAt,
  };
}

function validateComponents(value: unknown): Component[] {
  if (!Array.isArray(value) || value.length > MAX_COMPONENTS)
    throw new Error(
      `A library can contain up to ${MAX_COMPONENTS.toLocaleString('en-US')} components.`,
    );
  const components = value.map(validateComponent);
  if (new Set(components.map((item) => item.id)).size !== components.length)
    throw new Error('The file contains duplicate component IDs.');
  return components;
}

export function validateId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new Error('Invalid prompt ID.');
  }
  return value.toLowerCase();
}

export function validateRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('Invalid prompt revision.');
  }
  return value;
}

export function validateSpeedCopySlot(value: unknown): SpeedCopySlot | null {
  if (value === null || value === 1 || value === 2 || value === 3) return value;
  throw new Error('Choose speed-copy 1, 2, 3, or Unassigned.');
}

function validateSpeedCopy(
  value: unknown,
  prompts: Prompt[],
): { speedCopy?: SpeedCopy } {
  if (value === undefined) return {};
  if (!Array.isArray(value) || value.length !== 3)
    throw new Error('Invalid speed-copy assignments.');
  const slots = value.map((id: unknown) =>
    id === null ? null : validateId(id),
  ) as SpeedCopy;
  const ids = slots.filter((id) => id !== null);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !prompts.some((prompt) => prompt.id === id))
  ) {
    throw new Error('Invalid speed-copy assignments.');
  }
  return { speedCopy: slots };
}

function validateDate(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error('Invalid timestamp in prompt data.');
  }
  return value;
}

export function validatePrompt(value: unknown): Prompt {
  const item = record(value);
  const createdAt = validateDate(item.createdAt);
  const updatedAt = validateDate(item.updatedAt);
  if (updatedAt < createdAt)
    throw new Error('A prompt was updated before it was created.');
  return {
    ...validatePromptInput(item),
    id: validateId(item.id),
    revision: validateRevision(item.revision),
    createdAt,
    updatedAt,
  };
}

function validatePrompts(value: unknown): Prompt[] {
  if (!Array.isArray(value) || value.length > MAX_PROMPTS) {
    throw new Error(
      `A library can contain up to ${MAX_PROMPTS.toLocaleString('en-US')} prompts.`,
    );
  }
  const prompts = value.map(validatePrompt);
  if (new Set(prompts.map((prompt) => prompt.id)).size !== prompts.length) {
    throw new Error('The file contains duplicate prompt IDs.');
  }
  return prompts;
}

export function parseLibrary(value: unknown): Library {
  // New installations start empty. Existing unrecognized data is never reset.
  if (value === undefined)
    return { schemaVersion: SCHEMA_VERSION, prompts: [], components: [] };
  const library = record(value);
  if (library.schemaVersion !== 1 && library.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      'This library uses an unsupported data version. Update the extension before continuing.',
    );
  }
  const prompts = validatePrompts(library.prompts);
  if (
    library.schemaVersion === 1 &&
    prompts.some((item) => typeof item.content !== 'string')
  )
    throw new Error('Version 1 prompts must contain plain text.');
  const parsed: Library = {
    schemaVersion: SCHEMA_VERSION,
    prompts,
    components:
      library.schemaVersion === 1 ? [] : validateComponents(library.components),
    ...validateSpeedCopy(library.speedCopy, prompts),
  };
  validateComposition({ ...parsed, schemaVersion: SCHEMA_VERSION });
  syncSpeedCopyTags(parsed);
  return parsed;
}

export function validateBackup(value: unknown): Backup {
  const backup = record(value);
  if (
    backup.format !== 'prompt-library' ||
    (backup.version !== 1 && backup.version !== SCHEMA_VERSION)
  ) {
    throw new Error('Choose a Prompt Library JSON backup with version 1 or 2.');
  }
  const prompts = validatePrompts(backup.prompts);
  if (
    backup.version === 1 &&
    prompts.some((item) => typeof item.content !== 'string')
  )
    throw new Error('Version 1 prompts must contain plain text.');
  const parsed: Backup = {
    format: 'prompt-library',
    version: SCHEMA_VERSION,
    exportedAt: validateDate(backup.exportedAt),
    prompts,
    components:
      backup.version === 1 ? [] : validateComponents(backup.components),
    ...validateSpeedCopy(backup.speedCopy, prompts),
  };
  validateComposition({ ...parsed, schemaVersion: SCHEMA_VERSION });
  syncSpeedCopyTags(parsed);
  return parsed;
}

export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) {
    throw new Error('The backup must be 8 MB or smaller.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(
      'This file is not valid JSON. Choose a Prompt Library backup.',
    );
  }
  return validateBackup(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}
