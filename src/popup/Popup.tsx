import { useState } from 'react';
import type { Prompt, PromptInput, SpeedCopySlot } from '../domain/models';
import { assignedSlot } from '../domain/speed-copy';
import { SpeedCopyButtons } from '../features/prompts/SpeedCopyButtons';
import { getTags, selectPrompts } from '../domain/prompts';
import { errorMessage } from '../domain/validation';
import { isExtensionContext, sendCommand } from '../platform/client';
import { Icon } from '../app/components/Icon';
import { TooltipButton } from '../app/components/TooltipButton';
import { useLibrary } from '../app/hooks/useLibrary';
import { PromptEditor } from '../features/prompts/PromptEditor';
import { createEditorDraft } from '../features/prompts/editor-draft';
import { PopupPrompt } from './PopupPrompt';
import { usePopupDraft } from './usePopupDraft';
import { extensionApi } from '../platform/extension';

export function Popup() {
  const { library, loadError, reload } = useLibrary();
  const { draft, loaded, draftError, updateDraft, flushDraft } =
    usePopupDraft();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [opening, setOpening] = useState(false);

  function message(text: string, error = false) {
    setNotice({ text, error });
  }
  function edit(prompt: Prompt | null) {
    setNotice(null);
    updateDraft(createEditorDraft(prompt, assignedSlot(library, prompt?.id)));
  }

  async function save(input: PromptInput, speedCopy?: SpeedCopySlot | null) {
    if (!draft) return;
    await flushDraft();
    await sendCommand(
      draft.prompt
        ? {
            type: 'prompt:update',
            id: draft.prompt.id,
            revision: draft.prompt.revision,
            ...(draft.originalSpeedCopy === undefined
              ? {}
              : { expectedSpeedCopy: draft.originalSpeedCopy }),
            input,
            ...(speedCopy === undefined ? {} : { speedCopy }),
          }
        : {
            type: 'prompt:create',
            input,
            ...(speedCopy === undefined ? {} : { speedCopy }),
          },
    );
    await reload();
    setQuery('');
    setTag(null);
    message(draft.prompt ? 'Prompt updated.' : 'Prompt saved.');
  }

  async function openLibrary() {
    setOpening(true);
    try {
      await flushDraft();
      const api = extensionApi();
      await api.tabs.create({ url: api.runtime.getURL('index.html') });
      window.close();
    } catch (error) {
      message(`Could not open the full library. ${errorMessage(error)}`, true);
    } finally {
      setOpening(false);
    }
  }

  if (!isExtensionContext())
    return (
      <main className="standalone-state">
        <h1>Open Prompt Library from your browser</h1>
        <p>
          Install the build for your browser using the project’s setup guide,
          then click the extension icon.
        </p>
      </main>
    );

  const prompts = library?.prompts ?? [];
  const visible = selectPrompts(prompts, query, tag, 'updated');
  const ready = library !== null && !loadError && loaded;

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            [p]
          </span>
          <div>
            Prompt Library<span>Your everyday prompts, a click away.</span>
          </div>
        </div>
        <div className="popup-header-actions tooltip-group">
          <SpeedCopyButtons
            library={library}
            disabled={!ready}
            onMessage={message}
          />
          <TooltipButton
            className="icon-button open-library"
            aria-label="Open full library"
            tooltip="Open Library Management"
            onClick={() => {
              void openLibrary();
            }}
            disabled={opening || !loaded}
          >
            <Icon name="external" />
          </TooltipButton>
        </div>
      </header>
      <main className="popup-main">
        {(loadError || draftError) && (
          <div className="notice error" role="alert">
            <span>{loadError || draftError}</span>
            {loadError && (
              <button
                className="button"
                onClick={() => {
                  void reload();
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
        {notice && (
          <div
            className={`notice ${notice.error ? 'error' : ''}`}
            role={notice.error ? 'alert' : 'status'}
          >
            <span>{notice.text}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        {loaded && draft ? (
          <PromptEditor
            key={draft.prompt?.id ?? 'new'}
            layout="panel"
            prompt={draft.prompt}
            library={library}
            initialSpeedCopy={
              draft.originalSpeedCopy === undefined
                ? assignedSlot(library, draft.prompt?.id)
                : draft.originalSpeedCopy
            }
            initialFields={draft.fields}
            onDraftChange={(fields) => updateDraft({ ...draft, fields })}
            onSave={save}
            onClose={() => updateDraft(null)}
          />
        ) : (
          <>
            <div className="popup-search-row">
              <label className="search-field">
                <Icon name="search" />
                <input
                  type="search"
                  aria-label="Search prompts"
                  placeholder="Search prompts or tags…"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="popup-controls">
              <label className="popup-tag-filter">
                <span className="visually-hidden">Filter by tag</span>
                <select
                  value={tag ?? ''}
                  onChange={(event) => setTag(event.target.value || null)}
                  disabled={!ready}
                >
                  <option value="">All tags</option>
                  {getTags(prompts).map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.count})
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                onClick={() => edit(null)}
                disabled={!ready}
              >
                <Icon name="plus" />
                New prompt
              </button>
            </div>
            <div className="popup-results-heading">
              <span>
                {visible.length} {visible.length === 1 ? 'prompt' : 'prompts'}
              </span>
              {(query || tag) && (
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery('');
                    setTag(null);
                  }}
                >
                  Clear filters
                </button>
              )}
              <span>Recently updated</span>
            </div>
            <section
              className="popup-results"
              aria-label="Saved prompts"
              aria-busy={!library && !loadError}
            >
              {(!library || !loaded) && !loadError ? (
                <p className="popup-empty" role="status">
                  Opening your prompts…
                </p>
              ) : visible.length === 0 ? (
                <div className="popup-empty">
                  <h2>
                    {prompts.length === 0
                      ? 'Your next great prompt starts here.'
                      : 'No prompts found'}
                  </h2>
                  <p>
                    {prompts.length === 0
                      ? 'Add your first prompt and keep it close.'
                      : 'Try another search or clear your filters.'}
                  </p>
                </div>
              ) : (
                visible.map((prompt) => (
                  <PopupPrompt
                    key={prompt.id}
                    prompt={prompt}
                    disabled={!ready}
                    onEdit={edit}
                    onMessage={message}
                  />
                ))
              )}
            </section>
          </>
        )}
      </main>
      <footer className="popup-footer">
        <span>
          <Icon name="lock" />
          Local &amp; private
        </span>
        <span>Import, export &amp; more in the full library</span>
      </footer>
    </div>
  );
}
