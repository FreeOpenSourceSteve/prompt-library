import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  browserTargets,
  createManifest,
  parseTarget,
  targetConfig,
} from '../config/targets.ts';

const requested = process.argv.slice(2);
for (const target of requested.length
  ? requested.map(parseTarget)
  : browserTargets) {
  const root = resolve(targetConfig(target).outDir);
  const manifest = JSON.parse(
    await readFile(join(root, 'manifest.json'), 'utf8'),
  );
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.deepEqual(
    manifest,
    createManifest(target),
    `Unexpected ${target} manifest.`,
  );
  assert.equal(manifest.manifest_version, 3);
  assert.equal(
    manifest.version,
    pkg.version,
    'Keep package and manifest versions in sync.',
  );
  assert.deepEqual(
    manifest.permissions,
    target === 'chrome'
      ? ['storage', 'clipboardWrite', 'offscreen']
      : ['storage', 'clipboardWrite'],
    'Review any additional permissions explicitly.',
  );
  for (const key of [
    'host_permissions',
    'optional_host_permissions',
    'content_scripts',
    'externally_connectable',
    'web_accessible_resources',
  ]) {
    assert.equal(
      manifest[key],
      undefined,
      `${key} is outside this extension's local-only scope.`,
    );
  }
  assert.ok(
    manifest.content_security_policy.extension_pages.includes(
      "connect-src 'none'",
    ),
  );
  assert.ok(
    manifest.content_security_policy.extension_pages.includes(
      "script-src 'self'",
    ),
  );
  assert.equal(manifest.background.type, 'module');
  if (target === 'chrome')
    assert.equal(manifest.background.service_worker, 'service-worker.js');
  else {
    assert.deepEqual(manifest.background.scripts, ['background.js']);
    assert.equal(manifest.background.service_worker, undefined);
    assert.equal(manifest.minimum_chrome_version, undefined);
  }
  assert.equal(manifest.action.default_popup, 'popup.html');
  for (const file of [
    'THIRD_PARTY_NOTICES.txt',
    targetConfig(target).backgroundFile,
    ...(target === 'chrome' ? ['clipboard.html'] : []),
    'index.html',
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ]) {
    await access(join(root, file));
  }
  for (const entry of [
    'index.html',
    manifest.action.default_popup,
    ...(target === 'chrome' ? ['clipboard.html'] : []),
  ]) {
    const html = await readFile(join(root, entry), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/gu)) {
      const file = match[1];
      assert.ok(
        !/^(?:https?:)?\/\//u.test(file),
        'All extension resources must be packaged locally.',
      );
      if (!file.startsWith('#')) await access(join(root, file));
    }
  }
  const assets = await readdir(join(root, 'assets'));
  assert.ok(
    !assets.some((name) => name.endsWith('.map')),
    'Release builds should not include source maps.',
  );
  console.log(
    `Verified ${target}: Manifest V3, local-only permissions, version, CSP, icons, and bundled entry points.`,
  );
}
