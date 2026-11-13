import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type {
  Backup,
  Command,
  Prompt,
  SortOrder,
  SpeedCopySlot,
} from '../domain/models';
import { getTags, selectPrompts } from '../domain/prompts';
import { assignedSlot } from '../domain/speed-copy';
import { errorMessage } from '../domain/validation';
import { isExtensionContext, sendCommand } from '../platform/client';
import { downloadBackup, readBackup } from '../platform/files';
import { ImportDialog } from '../features/backups/ImportDialog';
import { DeleteDialog } from '../features/prompts/DeleteDialog';
import { PromptCard } from '../features/prompts/PromptCard';
import { PromptEditor } from '../features/prompts/PromptEditor';
import { Icon } from './components/Icon';
import { useLibrary } from './hooks/useLibrary';
import { extensionApi } from '../platform/extension';

export function App() {
  const { library, loadError, reload } = useLibrary();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOrder>('updated');
  const [editor, setEditor] = useState<{
    prompt: Prompt | null;
    speedCopy: SpeedCopySlot | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<Prompt | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);

  function message(text: string, error = false) {
    setNotice({ text, error });
  }

  async function mutate(command: Command, success: string) {
    setBusy(true);
    try {
      const result = await sendCommand(command);
      await reload();
      message(
        command.type === 'library:import'
          ? `Imported ${result.imported ?? 0} prompts. Skipped ${result.skipped ?? 0} existing prompts.`
          : success,
      );
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(prompt: Prompt) {
    try {
      await mutate(
        { type: 'prompt:duplicate', id: prompt.id },
        'Prompt duplicated.',
      );
    } catch (error) {
      message(errorMessage(error), true);
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      setBackup(await readBackup(file));
    } catch (error) {
      message(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function exportAll() {
    setBusy(true);
    try {
      const result = await sendCommand({ type: 'library:list' });
      downloadBackup(result.library);
      message('Backup download started. Keep this file somewhere safe.');
    } catch (error) {
      message(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  }

  if (!isExtensionContext())
    return (
      <main className="standalone-state">
        <h1>Load Prompt Library in your browser</h1>
        <p>
          Install the build for your browser using the project’s setup guide.
          Open it from your browser’s extension toolbar.
        </p>
      </main>
    );

  const prompts = library?.prompts ?? [];
  const tags = getTags(prompts);
  const visible = selectPrompts(prompts, query, tag, sort);
  const ready = library !== null && !loadError;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#library-main">
        Skip to prompts
      </a>
      <aside className="sidebar" aria-label="Library navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            [p]
          </span>
          <div>
            Prompt Library<span>A little space for big ideas.</span>
          </div>
        </div>
        <div className="sidebar-section">
          <span className="eyebrow">WORKSPACE</span>
          <button
            className={`nav-item ${tag === null ? 'active' : ''}`}
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
          >
            <Icon name="library" />
            <span>All prompts</span>
            <span className="count">{prompts.length}</span>
          </button>
        </div>
        <div className="sidebar-section tag-navigation">
          <div className="sidebar-label">
            <span className="eyebrow">TAGS</span>
            <span className="muted">{tags.length}</span>
          </div>
          {tags.length === 0 ? (
            <p className="sidebar-hint">
              Add tags to a prompt to organize your ideas here.
            </p>
          ) : (
            tags.map((item) => (
              <button
                key={item.name}
                className={`nav-item ${tag === item.name ? 'active' : ''}`}
                aria-pressed={tag === item.name}
                onClick={() => setTag(tag === item.name ? null : item.name)}
              >
                <Icon name="tag" />
                <span className="tag-name">{item.name}</span>
                <span className="count">{item.count}</span>
              </button>
            ))
          )}
        </div>
        <div className="privacy-note">
          <Icon name="lock" />
          <div>
            <strong>Just yours. Always local.</strong>
            <p>
              Saved in this browser profile.
              <br />
              No accounts. No cloud. No tracking.
            </p>
            <p>Export a backup before uninstalling.</p>
          </div>
        </div>
        <div className="sidebar-version">
          PROMPT LIBRARY{' '}
          <span>v{extensionApi().runtime.getManifest().version}</span>
        </div>
      </aside>
      <main id="library-main" className="main-content" tabIndex={-1}>
        <header className="page-header">
          <div>
            <span className="eyebrow">COLLECT. REFINE. REUSE.</span>
            <h1>
              {tag ? `# ${tag}` : 'Your prompt library'}
              <span className="heading-dot">.</span>
            </h1>
            <p>Your best thinking, ready when you need it.</p>
          </div>
          <div className="header-actions">
            <button
              className="button"
              onClick={() => fileInput.current?.click()}
              disabled={!ready || busy}
            >
              <Icon name="upload" />
              Import
            </button>
            <button
              className="button"
              onClick={() => {
                void exportAll();
              }}
              disabled={!ready || busy}
            >
              <Icon name="download" />
              Export all
            </button>
            <button
              className="button primary"
              onClick={() => setEditor({ prompt: null, speedCopy: null })}
              disabled={!ready || busy}
            >
              <Icon name="plus" />
              New prompt
            </button>
          </div>
        </header>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          tabIndex={-1}
          aria-label="Import backup file"
          onChange={(event) => {
            void selectFile(event);
          }}
        />
        {loadError && (
          <div className="notice error" role="alert">
            <span>{loadError}</span>
            <button
              className="button"
              onClick={() => {
                void reload();
              }}
            >
              Retry
            </button>
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
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Search prompts"
              placeholder="Search your prompts…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="sort-field">
            Sort by
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOrder)}
              aria-label="Sort prompts"
            >
              <option value="updated">Recently updated</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>
        <div className="results-heading">
          <span>
            {visible.length} {visible.length === 1 ? 'prompt' : 'prompts'}
            {query || tag ? ` / ${prompts.length} total` : ''}
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
          <span className="plain-text-note">
            Plain text. Endless possibilities.
          </span>
        </div>
        {!library && !loadError ? (
          <div className="empty-state" role="status">
            <h2>Opening your library…</h2>
          </div>
        ) : library && visible.length === 0 ? (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true">
              [ &nbsp; ]
            </span>
            <h2>
              {prompts.length === 0
                ? 'Good ideas deserve a place to stay.'
                : 'No prompts found'}
            </h2>
            <p>
              {prompts.length === 0
                ? 'Save a prompt you love. Tag it, make it your own, and use it again.'
                : 'Try another search or clear your tag filter.'}
            </p>
            {prompts.length === 0 ? (
              <button
                className="button primary"
                onClick={() => setEditor({ prompt: null, speedCopy: null })}
                disabled={!ready || busy}
              >
                <Icon name="plus" />
                Save your first prompt
              </button>
            ) : (
              <button
                className="button"
                onClick={() => {
                  setQuery('');
                  setTag(null);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="prompt-grid">
            {visible.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                disabled={busy || !ready}
                onEdit={(prompt) =>
                  setEditor({
                    prompt,
                    speedCopy: assignedSlot(library, prompt.id),
                  })
                }
                onDuplicate={(prompt) => {
                  void duplicate(prompt);
                }}
                onDelete={setDeleting}
                onTag={setTag}
                onMessage={message}
              />
            ))}
          </div>
        )}
        <footer className="page-footer">
          <span>Made for the prompts worth keeping.</span>
          <span>
            <Icon name="lock" />
            Offline &amp; private
          </span>
        </footer>
      </main>
      {editor && (
        <PromptEditor
          prompt={editor.prompt}
          library={library}
          initialSpeedCopy={editor.speedCopy}
          onClose={() => setEditor(null)}
          onSave={(input, speedCopy) =>
            mutate(
              editor.prompt
                ? {
                    type: 'prompt:update',
                    id: editor.prompt.id,
                    revision: editor.prompt.revision,
                    expectedSpeedCopy: editor.speedCopy,
                    input,
                    ...(speedCopy === undefined ? {} : { speedCopy }),
                  }
                : {
                    type: 'prompt:create',
                    input,
                    ...(speedCopy === undefined ? {} : { speedCopy }),
                  },
              editor.prompt ? 'Prompt updated.' : 'Prompt saved.',
            )
          }
        />
      )}
      {deleting && (
        <DeleteDialog
          prompt={deleting}
          onClose={() => setDeleting(null)}
          onDelete={() =>
            mutate(
              {
                type: 'prompt:delete',
                id: deleting.id,
                revision: deleting.revision,
              },
              'Prompt deleted.',
            )
          }
        />
      )}
      {backup && library && (
        <ImportDialog
          backup={backup}
          library={library}
          onClose={() => setBackup(null)}
          onImport={() =>
            mutate({ type: 'library:import', backup }, 'Prompts imported.')
          }
        />
      )}
    </div>
  );
}
