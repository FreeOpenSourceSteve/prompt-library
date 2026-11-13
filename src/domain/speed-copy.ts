import type { Library, SpeedCopySlot } from './models';

export const SPEED_COPY_TAG = '!';

export function ordinaryTags(tags: string[]): string[] {
  return tags.filter((tag) => tag !== SPEED_COPY_TAG);
}

// Slots are authoritative. The reserved tag is derived, never user-authored.
export function syncSpeedCopyTags(
  library: Pick<Library, 'prompts' | 'speedCopy'>,
): void {
  const assigned = new Set(library.speedCopy ?? []);
  for (const prompt of library.prompts) {
    if (assigned.has(prompt.id)) {
      if (!prompt.tags.includes(SPEED_COPY_TAG))
        prompt.tags.push(SPEED_COPY_TAG);
    } else if (prompt.tags.includes(SPEED_COPY_TAG)) {
      prompt.tags = ordinaryTags(prompt.tags);
    }
  }
}

export function assignedSlot(
  library: Library | null,
  id?: string,
): SpeedCopySlot | null {
  const index = id ? (library?.speedCopy?.indexOf(id) ?? -1) : -1;
  return index < 0 ? null : ((index + 1) as SpeedCopySlot);
}

// Assignment data lives outside prompt metadata. Only the marker tag changes.
export function assignSpeedCopy(
  library: Library,
  id: string,
  slot: SpeedCopySlot | null,
): void {
  const slots = library.speedCopy ?? [null, null, null];
  for (let index = 0; index < slots.length; index++) {
    if (slots[index] === id) slots[index] = null;
  }
  if (slot !== null) {
    slots[slot - 1] = id;
  }
  library.speedCopy = slots;
  syncSpeedCopyTags(library);
}
