import { useState } from 'react';
import type { Prompt } from '../../domain/models';
import { errorMessage } from '../../domain/validation';

export function usePromptCopy(
  prompt: Prompt,
  resolveContent: (id: string) => string,
  onMessage: (message: string, error?: boolean) => void,
) {
  const [copying, setCopying] = useState(false);
  async function copy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(resolveContent(prompt.id));
      onMessage(`Copied “${prompt.title}” to clipboard.`);
    } catch (error) {
      onMessage(
        `Could not copy the prompt. ${errorMessage(error)} Open Edit to select and copy the text manually.`,
        true,
      );
    } finally {
      setCopying(false);
    }
  }
  return { copying, copy };
}
