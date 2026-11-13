import type { Prompt } from '../../domain/models';
import { Icon } from '../../app/components/Icon';
import { usePromptCopy } from './usePromptCopy';

export function PromptCard({
  prompt,
  disabled,
  onEdit,
  onDuplicate,
  onDelete,
  onTag,
  onMessage,
}: {
  prompt: Prompt;
  disabled: boolean;
  onEdit: (prompt: Prompt) => void;
  onDuplicate: (prompt: Prompt) => void;
  onDelete: (prompt: Prompt) => void;
  onTag: (tag: string) => void;
  onMessage: (message: string, error?: boolean) => void;
}) {
  const { copying, copy } = usePromptCopy(prompt, onMessage);

  return (
    <article className="prompt-card" aria-label={prompt.title}>
      <div className="card-heading">
        <span className="card-glyph" aria-hidden="true">
          ↳
        </span>
        <span className="eyebrow">PLAIN TEXT</span>
      </div>
      <h2>{prompt.title}</h2>
      <p className="prompt-preview">{prompt.content}</p>
      <div className="card-tags">
        {prompt.tags.map((tag) => (
          <button
            key={tag}
            className="tag"
            onClick={() => onTag(tag)}
            aria-label={`Filter by ${tag}`}
          >
            {tag}
          </button>
        ))}
      </div>
      <div className="card-meta">
        Updated{' '}
        {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
          new Date(prompt.updatedAt),
        )}
      </div>
      <div className="card-actions">
        <button
          className="button copy-button"
          onClick={() => {
            void copy();
          }}
          disabled={copying}
        >
          <Icon name="copy" />
          {copying ? 'Copying…' : 'Copy prompt'}
        </button>
        <div className="secondary-actions">
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
            className="icon-button"
            aria-label={`Duplicate ${prompt.title}`}
            title="Duplicate prompt"
            onClick={() => onDuplicate(prompt)}
            disabled={disabled}
          >
            <Icon name="duplicate" />
          </button>
          <button
            className="icon-button danger-text"
            aria-label={`Delete ${prompt.title}`}
            title="Delete prompt"
            onClick={() => onDelete(prompt)}
            disabled={disabled}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </article>
  );
}
