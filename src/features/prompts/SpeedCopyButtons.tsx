import { useState } from 'react';
import type { Library, SpeedCopySlot } from '../../domain/models';
import { SPEED_COPY_SLOTS } from '../../domain/models';
import { errorMessage } from '../../domain/validation';
import { TooltipButton } from '../../app/components/TooltipButton';

export function SpeedCopyButtons({
  library,
  disabled,
  onMessage,
}: {
  library: Library | null;
  disabled: boolean;
  onMessage: (text: string, error?: boolean) => void;
}) {
  const [copying, setCopying] = useState<SpeedCopySlot | null>(null);
  return (
    <div
      className="speed-copy-buttons"
      role="group"
      aria-label="Speed-copy prompts"
    >
      {SPEED_COPY_SLOTS.map((slot) => {
        const prompt = library?.prompts.find(
          (item) => item.id === library.speedCopy?.[slot - 1],
        );
        return (
          <TooltipButton
            key={slot}
            className="icon-button speed-copy-button"
            aria-label={`Speed-copy ${slot}${prompt ? `: ${prompt.title}` : ' (unassigned)'}`}
            tooltip={
              prompt
                ? `Copy "${prompt.title}" ——— Cmd/Ctrl/${['Z', 'X', 'C'][slot - 1]}`
                : `Speed-copy ${slot}: assign a prompt in Edit`
            }
            disabled={disabled || !prompt || copying !== null}
            onClick={() => {
              if (!prompt) return;
              setCopying(slot);
              void navigator.clipboard
                .writeText(prompt.content)
                .then(() => onMessage(`Copied “${prompt.title}” to clipboard.`))
                .catch((error: unknown) =>
                  onMessage(
                    `Could not copy the prompt. ${errorMessage(error)}`,
                    true,
                  ),
                )
                .finally(() => setCopying(null));
            }}
          >
            {slot}
          </TooltipButton>
        );
      })}
    </div>
  );
}
