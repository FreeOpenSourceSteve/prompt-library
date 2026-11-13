import type { Prompt } from '../domain/models';
import { Icon } from '../app/components/Icon';
import { usePromptCopy } from '../features/prompts/usePromptCopy';

export function PopupPrompt({
  prompt,
  disabled,
  onEdit,
  onMessage,
}: {
  prompt: Prompt;
  disabled: boolean;
  onEdit: (prompt: Prompt) => void;
  onMessage: (message: string, error?: boolean) => void;
}) {
  const { copying, copy } = usePromptCopy(prompt, onMessage);
  return (
    <article className="popup-prompt" aria-label={prompt.title}>
      <details>
        <summary>
          <h2>{prompt.title}</h2>
          <p className="popup-preview">{prompt.content}</p>
          <span className="popup-view-label">View full prompt</span>
        </summary>
        <pre className="popup-full-text">{prompt.content}</pre>
      </details>
      <div className="popup-prompt-bottom">
        <div className="popup-tags">
          {prompt.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="popup-prompt-actions">
          <button
            className="icon-button"
            aria-label={`Edit ${prompt.title}`}
            title="Edit prompt"
            onClick={() => onEdit(prompt)}
            disabled={disabled}
          >
            <Icon name="edit" />
          </button>
          <button
            className="button copy-button"
            onClick={() => {
              void copy();
            }}
            disabled={copying}
          >
            <Icon name="copy" />
            {copying ? 'Copying…' : 'Copy'}
          </button>
        </div>
      </div>
    </article>
  );
}
