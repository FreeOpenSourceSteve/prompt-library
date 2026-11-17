import {
  createContentResolver,
  joinComponentText,
} from '../../domain/composition';
import type {
  Library,
  ComponentUpdate,
  NewComponent,
  Prompt,
  PromptContent,
  PromptPart,
  SpeedCopySlot,
} from '../../domain/models';
import { ordinaryTags } from '../../domain/speed-copy';
import {
  validatePrompt,
  record,
  validateSpeedCopySlot,
  validateId,
  validateRevision,
  validateComponentInput,
} from '../../domain/validation';

export type ComponentDraft =
  | PromptPart
  | { type: 'new'; id: string; name: string; content: string; tags?: string };

export interface ComponentEditDraft {
  id: string;
  revision: number;
  name: string;
  content: string;
  tags: string;
}

export interface EditorFields {
  title: string;
  content: string;
  tags: string;
  parts?: ComponentDraft[];
  componentEdits?: ComponentEditDraft[];
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
      content: typeof prompt?.content === 'string' ? prompt.content : '',
      ...(Array.isArray(prompt?.content)
        ? { parts: prompt.content.map((part) => ({ ...part })) }
        : {}),
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
      ...(fields.parts === undefined
        ? {}
        : { parts: parseComponentDrafts(fields.parts) }),
      ...(fields.componentEdits === undefined
        ? {}
        : { componentEdits: parseComponentEdits(fields.componentEdits) }),
      ...(fields.speedCopy === undefined
        ? {}
        : { speedCopy: validateSpeedCopySlot(fields.speedCopy) }),
    },
    ...(draft.originalSpeedCopy === undefined
      ? {}
      : { originalSpeedCopy: validateSpeedCopySlot(draft.originalSpeedCopy) }),
  };
}

function parseComponentDrafts(value: unknown): ComponentDraft[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('The previous component draft could not be restored.');
  return value.map((value: unknown) => {
    const part = record(value);
    const id = validateId(part.id);
    if (part.type === 'component' || part.type === 'prompt')
      return { type: part.type, id };
    if (
      part.type === 'new' &&
      typeof part.name === 'string' &&
      typeof part.content === 'string' &&
      (part.tags === undefined || typeof part.tags === 'string')
    )
      return {
        type: 'new',
        id,
        name: part.name,
        content: part.content,
        ...(part.tags === undefined ? {} : { tags: part.tags as string }),
      };
    throw new Error('The previous component draft could not be restored.');
  });
}
export function componentInput(parts: ComponentDraft[]): {
  content: PromptContent;
  newComponents: NewComponent[];
} {
  return {
    content: parts.map((part) => ({
      type: part.type === 'new' ? 'component' : part.type,
      id: part.id,
    })),
    newComponents: parts.flatMap((part) =>
      part.type === 'new'
        ? [
            {
              id: part.id,
              ...validateComponentInput({
                name: part.name,
                content: part.content,
                tags: (part.tags ?? '').split(','),
              }),
            },
          ]
        : [],
    ),
  };
}

export function draftContent(
  parts: ComponentDraft[],
  library: Library | null,
  edits: ComponentEditDraft[] = [],
): string {
  const resolver = createContentResolver(componentDraftLibrary(library, edits));
  return joinComponentText(
    parts.map((part) =>
      part.type === 'new' ? part.content : resolver.content([part]),
    ),
  );
}

function parseComponentEdits(value: unknown): ComponentEditDraft[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error('The previous component edits could not be restored.');
  const edits = value.map((value: unknown) => {
    const edit = record(value);
    if (
      typeof edit.name !== 'string' ||
      typeof edit.content !== 'string' ||
      typeof edit.tags !== 'string'
    )
      throw new Error('The previous component edits could not be restored.');
    return {
      id: validateId(edit.id),
      revision: validateRevision(edit.revision),
      name: edit.name,
      content: edit.content,
      tags: edit.tags,
    };
  });
  if (new Set(edits.map((edit) => edit.id)).size !== edits.length)
    throw new Error('The previous component edits could not be restored.');
  return edits;
}

export function componentUpdates(
  edits: ComponentEditDraft[],
): ComponentUpdate[] {
  return edits.map((edit) => ({
    id: edit.id,
    revision: edit.revision,
    input: validateComponentInput({ ...edit, tags: edit.tags.split(',') }),
  }));
}

export function componentDraftLibrary(
  library: Library | null,
  edits: ComponentEditDraft[] = [],
): Pick<Library, 'prompts' | 'components'> {
  if (!library) return { prompts: [], components: [] };
  if (!edits.length) return library;
  const changes = new Map(edits.map((edit) => [edit.id, edit]));
  return {
    prompts: library.prompts,
    components: library.components.map((component) => {
      const edit = changes.get(component.id);
      return edit
        ? {
            ...component,
            name: edit.name,
            content: edit.content,
            tags: edit.tags.split(','),
          }
        : component;
    }),
  };
}
