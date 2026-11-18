// The Clipboard API uses native Windows CRLF line endings. Keep the expected
// clipboard representation separate from exact storage/backup text assertions.
// https://www.w3.org/TR/clipboard-apis/#dom-clipboard-writetext
export function nativeClipboardText(
  text: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === 'win32' ? text.replace(/\r?\n/gu, '\r\n') : text;
}
