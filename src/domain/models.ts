export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'prompt-library';
export const POPUP_DRAFT_KEY = 'popup-editor-draft';
export const MAX_PROMPTS = 2000;
export const MAX_TITLE_LENGTH = 160;
export const MAX_CONTENT_LENGTH = 100_000;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
// Leave room for the backup envelope so every saved library can be re-imported.
export const MAX_STORAGE_BYTES = MAX_FILE_BYTES - 1024;
export const SPEED_COPY_SLOTS = [1, 2, 3] as const;
export type SpeedCopySlot = (typeof SPEED_COPY_SLOTS)[number];
export type SpeedCopy = [string | null, string | null, string | null];

export interface PromptInput {
  title: string;
  content: string;
  tags: string[];
}

export interface Prompt extends PromptInput {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface Library {
  schemaVersion: typeof SCHEMA_VERSION;
  prompts: Prompt[];
  speedCopy?: SpeedCopy;
}

export interface Backup {
  format: 'prompt-library';
  version: typeof SCHEMA_VERSION;
  exportedAt: string;
  prompts: Prompt[];
  speedCopy?: SpeedCopy;
}

export type Command =
  | { type: 'library:list' }
  | {
      type: 'prompt:create';
      input: PromptInput;
      speedCopy?: SpeedCopySlot | null;
    }
  | {
      type: 'prompt:update';
      id: string;
      revision: number;
      input: PromptInput;
      speedCopy?: SpeedCopySlot | null;
      expectedSpeedCopy?: SpeedCopySlot | null;
    }
  | { type: 'prompt:duplicate'; id: string }
  | { type: 'prompt:delete'; id: string; revision: number }
  | { type: 'library:import'; backup: Backup };

export type Response =
  | { ok: true; library: Library; imported?: number; skipped?: number }
  | { ok: false; error: string };

export type SortOrder = 'updated' | 'oldest' | 'title';
