import type { Prompt, SpeedCopySlot } from '../../domain/models';
import { ordinaryTags } from '../../domain/speed-copy';
import {
  validatePrompt,
  record,
  validateSpeedCopySlot,
} from '../../domain/validation';

export interface EditorFields {
  title: string;
  content: string;
  tags: string;
  speedCopy?: SpeedCopySlot | null;
}

export interface EditorDraft {
  prompt: Prompt | null;
  fields: EditorFields;
  originalSpeedCopy?: SpeedCopySlot | null;
}

export function createEditorDraft(
  prompt: Prompt | null,
  speedCopy?: SpeedCopySlot | null,
): EditorDraft {
  return {
    prompt,
    fields: {
      title: prompt?.title ?? '',
      content: prompt?.content ?? '',
      tags: ordinaryTags(prompt?.tags ?? []).join(', '),
      ...(speedCopy === undefined ? {} : { speedCopy }),
    },
    ...(speedCopy === undefined ? {} : { originalSpeedCopy: speedCopy }),
  };
}

export function parseEditorDraft(value: unknown): EditorDraft | null {
  if (value === undefined) return null;
  const draft = record(value);
  const fields = record(draft.fields);
  // Drafts may be incomplete or invalid for saving, but their text must survive.
  if (
    typeof fields.title !== 'string' ||
    typeof fields.content !== 'string' ||
    typeof fields.tags !== 'string'
  ) {
    throw new Error('The previous popup draft could not be restored.');
  }
  const prompt = draft.prompt === null ? null : validatePrompt(draft.prompt);
  if (prompt === undefined)
    throw new Error('The previous popup draft could not be restored.');
  return {
    prompt,
    fields: {
      title: fields.title,
      content: fields.content,
      tags: fields.tags,
      ...(fields.speedCopy === undefined
        ? {}
        : { speedCopy: validateSpeedCopySlot(fields.speedCopy) }),
    },
    ...(draft.originalSpeedCopy === undefined
      ? {}
      : { originalSpeedCopy: validateSpeedCopySlot(draft.originalSpeedCopy) }),
  };
}
