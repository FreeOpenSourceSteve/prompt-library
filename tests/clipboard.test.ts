import { expect, it } from 'vitest';
import { nativeClipboardText } from './clipboard';

it('models Windows clipboard line endings while preserving literal text, blank lines, and spaces', () => {
  const input = '  Role: tutor <literal>\n\nTask: café\n  ';
  expect(nativeClipboardText(input, 'win32')).toBe(
    '  Role: tutor <literal>\r\n\r\nTask: café\r\n  ',
  );
});

it('does not double existing CRLF or remove standalone carriage returns on Windows', () => {
  expect(nativeClipboardText('First\r\nSecond\nThird\r  ', 'win32')).toBe(
    'First\r\nSecond\r\nThird\r  ',
  );
});

it.each(['darwin', 'linux'] as const)(
  'preserves the expected clipboard text on %s',
  (platform) => {
    const input = '  Literal <html>\n\nKeep all spaces  \n';
    expect(nativeClipboardText(input, platform)).toBe(input);
  },
);
