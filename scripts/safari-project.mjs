import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

if (process.platform !== 'darwin') {
  throw new Error(
    'Local Xcode project generation requires macOS. The Safari ZIP can also be packaged from any OS using Apple’s Safari Web Extension Packager in App Store Connect. See docs/browser-support.md.',
  );
}
const packager = [
  'safari-web-extension-packager',
  'safari-web-extension-converter',
].find(
  (tool) =>
    spawnSync('xcrun', ['--find', tool], { stdio: 'ignore' }).status === 0,
);
if (!packager)
  throw new Error(
    'Install full Xcode and select its Developer directory with xcode-select. Command Line Tools alone do not include Safari’s packager. You can still load build/safari temporarily in current Safari, or use App Store Connect. See docs/browser-support.md.',
  );
execFileSync(
  'xcrun',
  [
    packager,
    resolve('build/safari'),
    '--project-location',
    resolve('safari-project'),
    '--app-name',
    'Prompt Library',
    '--bundle-identifier',
    process.argv[2] || 'local.promptlibrary',
    '--macos-only',
    '--swift',
    '--no-open',
    '--no-prompt',
  ],
  { stdio: 'inherit' },
);
console.log(
  'Created safari-project. Select your Apple signing team and bundle identifier in Xcode before distribution.',
);
