import type { LibraryService } from './library-service';

export function registerSpeedCopyCommands(
  api: typeof chrome,
  service: LibraryService,
) {
  let queue: Promise<unknown> = Promise.resolve();
  async function copy(command: string) {
    const match = /^speed-copy-([123])$/u.exec(command);
    if (!match) return;
    const slot = Number(match[1]);
    try {
      const result = await service.execute({ type: 'library:list' });
      if (!result.ok) throw new Error('Could not load the prompt library.');
      const id = result.library.speedCopy?.[slot - 1];
      const prompt = result.library.prompts.find((item) => item.id === id);
      if (!prompt)
        throw new Error(
          `Speed-copy ${slot} is unassigned. Assign a prompt in Edit.`,
        );
      if (api.runtime.getURL('').startsWith('chrome-extension://')) {
        const url = api.runtime.getURL('clipboard.html');
        const contexts = await api.runtime.getContexts({
          contextTypes: [api.runtime.ContextType.OFFSCREEN_DOCUMENT],
          documentUrls: [url],
        });
        if (contexts.length === 0)
          await api.offscreen.createDocument({
            url: 'clipboard.html',
            reasons: [api.offscreen.Reason.CLIPBOARD],
            justification:
              'Copy the prompt selected by a user keyboard shortcut while the popup is closed.',
          });
        try {
          const response: unknown = await api.runtime.sendMessage({
            target: 'clipboard',
            text: prompt.content,
          });
          if (
            typeof response !== 'object' ||
            response === null ||
            !('ok' in response) ||
            response.ok !== true
          )
            throw new Error('Copy failed.');
        } finally {
          await api.offscreen.closeDocument();
        }
      } else {
        await navigator.clipboard.writeText(prompt.content);
      }
      await api.action.setBadgeText({ text: '' });
      await api.action.setTitle({ title: 'Prompt Library' });
    } catch (error) {
      await api.action.setBadgeText({ text: '!' });
      await api.action.setTitle({
        title:
          error instanceof Error && error.message.includes('unassigned')
            ? error.message
            : `Speed-copy ${slot} could not copy. Open Prompt Library and try the copy button.`,
      });
    }
  }
  // Serialize shortcuts so rapid presses cannot close another copy's document.
  api.commands.onCommand.addListener((command) => {
    queue = queue
      .then(() => copy(command))
      .catch(() => {
        console.error('Prompt Library could not complete speed-copy.');
      });
    return queue;
  });
}
