// Chromium exposes native Windows CRLF on clipboard readback; Firefox
// normalizes readback to LF and compares directly. Keep this expectation
// separate from exact storage/backup text assertions.
// https://www.w3.org/TR/clipboard-apis/#dom-clipboard-writetext
export function nativeClipboardText(
  text: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === 'win32' ? text.replace(/\r?\n/gu, '\r\n') : text;
}
