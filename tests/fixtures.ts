import type { Backup, Component, Library, Prompt } from '../src/domain/models';

export function prompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: '53bc046c-a823-43e7-854b-18a864414c7c',
    revision: 1,
    title: 'A useful prompt',
    content: '  # Keep this plain\n<script>alert("hello")</script>\n',
    tags: ['writing', 'work'],
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-02T12:00:00.000Z',
    ...overrides,
  };
}

export function library(prompts: Prompt[] = [prompt()]): Library {
  return { schemaVersion: 2, prompts, components: [] };
}
export function backup(prompts: Prompt[] = [prompt()]): Backup {
  return {
    format: 'prompt-library',
    version: 2,
    components: [],
    exportedAt: '2026-02-01T12:00:00.000Z',
    prompts,
  };
}

export function component(overrides: Partial<Component> = {}): Component {
  return {
    id: crypto.randomUUID(),
    name: 'Tutor role',
    tags: [],
    content: '\nRole: tutor\n\n',
    revision: 1,
    createdAt: prompt().createdAt,
    updatedAt: prompt().updatedAt,
    ...overrides,
  };
}
