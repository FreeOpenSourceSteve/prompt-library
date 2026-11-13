# Privacy

Prompt Library stores prompts, tags, IDs, revisions, timestamps, and speed-copy assignments locally in the browser profile in which it is installed. No account is required.

An unfinished popup editor draft, including its original prompt and current text, is temporarily stored in the browser's in-memory session storage so it can be recovered after the popup closes. It is cleared after saving, explicitly discarding the draft, restarting the browser, or reloading the extension. Saved prompts remain in local storage.

- No prompt data is transmitted by the extension.
- No analytics, advertising, telemetry, remote scripts, remote fonts, or server calls are included.
- No websites are read or modified. The extension has no host permissions or content scripts.
- The extension requests `storage` and `clipboardWrite`. Chrome additionally requests `offscreen` for a hidden clipboard document used by keyboard shortcuts.
- Copy writes only the chosen prompt’s body to the system clipboard after you click Copy, click a speed-copy button, or press its shortcut. The extension never reads clipboard data. Chrome clears the temporary clipboard field and closes the hidden document after each shortcut copy.
- Import reads only a file explicitly selected by you. Export creates a local JSON file containing the entire library.
- The content security policy blocks network connections from extension pages and its background service.

Local storage and JSON exports are not encrypted by this application. browser profile access, filesystem access, clipboard managers, and other applications may affect privacy outside the extension. Avoid storing passwords, API keys, or other credentials in prompt text.

Uninstalling the extension or deleting the profile removes local extension data. To retain your library, export a backup first. Delete individual prompts in the library to remove them from current storage; previously downloaded backups remain under your control.

This describes the included application code. Browser behavior, browser synchronization settings, operating system services, and developer tooling have their own policies. Update this document before introducing any future data collection, synchronization, or website integration.
