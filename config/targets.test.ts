import { describe, expect, it } from 'vitest';
import {
  browserTargets,
  createManifest,
  parseTarget,
  targetConfig,
} from './targets';

describe('browser targets', () => {
  it.each(browserTargets)(
    'defines all three requested Command + Control shortcuts in %s',
    (target) => {
      const manifest = createManifest(target);
      expect(
        Object.values(manifest.commands).map(
          (command) => command.suggested_key.mac,
        ),
      ).toEqual([
        'Command+MacCtrl+Z',
        'Command+MacCtrl+X',
        'Command+MacCtrl+C',
      ]);
    },
  );
  it('rejects unknown output targets instead of creating arbitrary paths', () => {
    expect(parseTarget('firefox')).toBe('firefox');
    expect(() => parseTarget('../elsewhere')).toThrow('Unknown browser');
    expect(targetConfig('chrome').outDir).toBe('dist');
  });
  it.each(browserTargets)(
    'preserves the popup and privacy boundary in %s',
    (target) => {
      const manifest = createManifest(target);
      expect(manifest.permissions).toEqual(
        target === 'chrome'
          ? ['storage', 'clipboardWrite', 'offscreen']
          : ['storage', 'clipboardWrite'],
      );
      expect(manifest.action.default_popup).toBe('popup.html');
      expect(manifest.content_security_policy.extension_pages).toContain(
        "connect-src 'none'",
      );
      expect(manifest).not.toHaveProperty('host_permissions');
      expect(manifest).not.toHaveProperty('content_scripts');
    },
  );
  it('selects a service worker for Chrome and module event pages elsewhere', () => {
    expect(createManifest('chrome').background).toEqual({
      service_worker: 'service-worker.js',
      type: 'module',
    });
    for (const target of ['firefox', 'safari'] as const) {
      const manifest = createManifest(target);
      expect(manifest.background).toEqual({
        scripts: ['background.js'],
        persistent: false,
        type: 'module',
      });
      expect(manifest).not.toHaveProperty('minimum_chrome_version');
    }
    expect(createManifest('firefox')).toHaveProperty(
      'browser_specific_settings.gecko.data_collection_permissions.required',
      ['none'],
    );
    expect(createManifest('safari')).toHaveProperty(
      'browser_specific_settings.safari.strict_min_version',
      '17.0',
    );
    createManifest('firefox').permissions.push('unexpected');
    expect(createManifest('chrome').permissions).toEqual([
      'storage',
      'clipboardWrite',
      'offscreen',
    ]);
  });
});
