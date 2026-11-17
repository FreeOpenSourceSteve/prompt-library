import {
  MAX_PROMPTS,
  MAX_COMPONENTS,
  SCHEMA_VERSION,
  MAX_STORAGE_BYTES,
  MAX_TITLE_LENGTH,
  STORAGE_KEY,
} from '../domain/models';
import type {
  Component,
  Library,
  Prompt,
  Response,
  SpeedCopy,
} from '../domain/models';
import {
  errorMessage,
  parseLibrary,
  record,
  validateBackup,
  validateId,
  validateInput,
  validateComponentInput,
  validateComponentUpdates,
  validateNewComponents,
  validateRevision,
  validateSpeedCopySlot,
} from '../domain/validation';
import {
  normalizedName,
  referencingPrompts,
  validateComposition,
} from '../domain/composition';
import {
  assignedSlot,
  assignSpeedCopy,
  ordinaryTags,
  syncSpeedCopyTags,
  SPEED_COPY_TAG,
} from '../domain/speed-copy';

export interface StorageAdapter {
  read(): Promise<unknown>;
  write(library: Library): Promise<void>;
}

export class LibraryService {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: StorageAdapter) {}

  // One worker owns all writes; every operation reads durable data, even after suspension.
  execute(value: unknown): Promise<Response> {
    const operation = this.queue.then(() => this.handle(value));
    this.queue = operation.catch(() => undefined);
    return operation.catch((error: unknown): Response => ({
      ok: false,
      error: errorMessage(error),
    }));
  }

  private async handle(value: unknown): Promise<Response> {
    const command = record(value);
    const stored = await this.storage.read();
    const library = parseLibrary(stored);
    let imported: number | undefined;
    let skipped: number | undefined;
    let importedComponents: number | undefined;
    let skippedComponents: number | undefined;

    switch (command.type) {
      case 'library:list': {
        // Persist a one-time repair of old manual or missing markers. Avoid
        // writing on ordinary reads, and leave unrelated metadata untouched.
        if (
          stored !== undefined &&
          ((stored as Library).schemaVersion !== SCHEMA_VERSION ||
            (stored as Library).prompts.some(
              (prompt, index) =>
                prompt.tags.includes(SPEED_COPY_TAG) !==
                library.prompts[index]?.tags.includes(SPEED_COPY_TAG),
            ))
        ) {
          await this.persist(library);
        }
        return { ok: true, library };
      }
      case 'prompt:create': {
        const now = new Date().toISOString();
        const id = crypto.randomUUID();
        this.addComponents(library, command.newComponents, now);
        this.updateComponents(library, command.componentUpdates);
        library.prompts.push({
          ...validateInput(command.input),
          id,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
        if (command.speedCopy !== undefined)
          assignSpeedCopy(
            library,
            id,
            validateSpeedCopySlot(command.speedCopy),
          );
        break;
      }
      case 'prompt:update': {
        const prompt = this.find(library, command.id);
        this.checkRevision(prompt, command.revision);
        if (
          command.expectedSpeedCopy !== undefined &&
          validateSpeedCopySlot(command.expectedSpeedCopy) !==
            assignedSlot(library, prompt.id)
        ) {
          throw new Error(
            'This prompt’s speed-copy assignment changed in another tab. Your draft is still here. Reopen the prompt before saving.',
          );
        }
        const input = validateInput(command.input);
        this.addComponents(
          library,
          command.newComponents,
          new Date().toISOString(),
        );
        this.updateComponents(library, command.componentUpdates);
        // The ! marker is managed separately; an assignment-only save must not
        // change revisions, timestamps, text, or other tags.
        const assignmentOnly =
          command.speedCopy !== undefined &&
          input.title === prompt.title &&
          JSON.stringify(input.content) === JSON.stringify(prompt.content) &&
          JSON.stringify(input.tags) ===
            JSON.stringify(ordinaryTags(prompt.tags));
        if (!assignmentOnly)
          Object.assign(prompt, input, {
            revision: validateRevision(prompt.revision + 1),
            updatedAt: new Date(
              Math.max(Date.now(), Date.parse(prompt.updatedAt)),
            ).toISOString(),
          });
        if (command.speedCopy !== undefined)
          assignSpeedCopy(
            library,
            prompt.id,
            validateSpeedCopySlot(command.speedCopy),
          );
        break;
      }
      case 'prompt:duplicate': {
        const prompt = this.find(library, command.id);
        const now = new Date().toISOString();
        let suffix = ' (copy)';
        let title =
          prompt.title.slice(0, MAX_TITLE_LENGTH - suffix.length) + suffix;
        const componentNames = new Set(
          library.components.map((item) => normalizedName(item.name)),
        );
        for (
          let index = 2;
          componentNames.has(normalizedName(title));
          index++
        ) {
          suffix = ` (copy ${index})`;
          title =
            prompt.title.slice(0, MAX_TITLE_LENGTH - suffix.length) + suffix;
        }
        library.prompts.push({
          ...prompt,
          tags: ordinaryTags(prompt.tags),
          title,
          id: crypto.randomUUID(),
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'prompt:delete': {
        const prompt = this.find(library, command.id);
        this.checkRevision(prompt, command.revision);
        this.checkReferences(library, 'prompt', prompt.id);
        library.prompts = library.prompts.filter(
          (item) => item.id !== prompt.id,
        );
        if (library.speedCopy)
          library.speedCopy = library.speedCopy.map((id) =>
            id === prompt.id ? null : id,
          ) as SpeedCopy;
        break;
      }
      case 'component:create': {
        const now = new Date().toISOString();
        library.components.push({
          ...validateComponentInput(command.input),
          id: crypto.randomUUID(),
          revision: 1,
          createdAt: now,
          updatedAt: now,
        });
        break;
      }
      case 'component:update': {
        this.updateComponents(library, [
          { id: command.id, revision: command.revision, input: command.input },
        ]);
        break;
      }
      case 'component:delete': {
        const component = this.findComponent(library, command.id);
        this.checkRevision(component, command.revision);
        this.checkReferences(library, 'component', component.id);
        library.components = library.components.filter(
          (item) => item.id !== component.id,
        );
        break;
      }
      case 'library:import': {
        const backup = validateBackup(command.backup);
        const ids = new Set(library.prompts.map((prompt) => prompt.id));
        const additions = backup.prompts.filter(
          (prompt) => !ids.has(prompt.id),
        );
        const componentIds = new Set(library.components.map((item) => item.id));
        const componentAdditions = backup.components.filter(
          (item) => !componentIds.has(item.id),
        );
        importedComponents = componentAdditions.length;
        skippedComponents =
          backup.components.length - componentAdditions.length;
        library.components.push(...componentAdditions);
        imported = additions.length;
        skipped = backup.prompts.length - additions.length;
        library.prompts.push(...additions);
        // Restore assignments for newly imported prompts into empty slots only.
        if (backup.speedCopy) {
          const slots = library.speedCopy ?? [null, null, null];
          const addedIds = new Set(additions.map((prompt) => prompt.id));
          backup.speedCopy.forEach((id, index) => {
            if (id && addedIds.has(id) && slots[index] === null)
              slots[index] = id;
          });
          library.speedCopy = slots;
        }
        break;
      }
      default:
        throw new Error('Unsupported library command.');
    }

    syncSpeedCopyTags(library);
    await this.persist(library);
    return {
      ok: true,
      library,
      ...(imported === undefined
        ? {}
        : {
            imported,
            skipped: skipped ?? 0,
            importedComponents: importedComponents ?? 0,
            skippedComponents: skippedComponents ?? 0,
          }),
    };
  }

  private async persist(library: Library): Promise<void> {
    if (library.prompts.length > MAX_PROMPTS)
      throw new Error(
        `Your library is limited to ${MAX_PROMPTS.toLocaleString('en-US')} prompts.`,
      );
    if (library.components.length > MAX_COMPONENTS)
      throw new Error(
        `Your library is limited to ${MAX_COMPONENTS.toLocaleString('en-US')} components.`,
      );
    // Validate the merged graph, including ancestors affected by shared edits.
    validateComposition(library);
    const bytes = new TextEncoder().encode(
      STORAGE_KEY + JSON.stringify(library),
    ).byteLength;
    if (bytes > MAX_STORAGE_BYTES)
      throw new Error(
        'Your library has reached its 8 MB limit. Export a backup and remove unused prompts.',
      );
    await this.storage.write(library);
  }

  private find(library: Library, id: unknown): Prompt {
    const validId = validateId(id);
    const prompt = library.prompts.find((item) => item.id === validId);
    if (!prompt)
      throw new Error(
        'This prompt no longer exists. Close the editor and refresh your library.',
      );
    return prompt;
  }

  private addComponents(library: Library, value: unknown, now: string): void {
    const ids = new Set(
      [...library.prompts, ...library.components].map((item) => item.id),
    );
    for (const input of validateNewComponents(value)) {
      if (ids.has(input.id))
        throw new Error(
          'A new component ID already exists. Reopen the editor and try again.',
        );
      ids.add(input.id);
      library.components.push({
        ...input,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private updateComponents(library: Library, value: unknown): void {
    for (const update of validateComponentUpdates(value)) {
      const component = this.findComponent(library, update.id);
      this.checkRevision(component, update.revision);
      Object.assign(component, update.input, {
        revision: validateRevision(component.revision + 1),
        updatedAt: new Date(
          Math.max(Date.now(), Date.parse(component.updatedAt)),
        ).toISOString(),
      });
    }
  }

  private findComponent(library: Library, id: unknown): Component {
    const validId = validateId(id);
    const component = library.components.find((item) => item.id === validId);
    if (!component)
      throw new Error(
        'This component no longer exists. Reopen component management.',
      );
    return component;
  }

  private checkReferences(
    library: Library,
    type: 'component' | 'prompt',
    id: string,
  ): void {
    const users = referencingPrompts(library, type, id);
    if (users.length)
      throw new Error(
        `Used by “${users[0]?.title}”${users.length > 1 ? ` and ${users.length - 1} other prompts` : ''}. Remove its references before deleting it.`,
      );
  }

  private checkRevision(prompt: Prompt | Component, revision: unknown): void {
    if (prompt.revision !== validateRevision(revision)) {
      throw new Error(
        `This ${'name' in prompt ? 'component' : 'prompt'} changed in another tab. Your draft is still here. Copy it, then reopen the ${'name' in prompt ? 'component' : 'prompt'} to edit the latest version.`,
      );
    }
  }
}
