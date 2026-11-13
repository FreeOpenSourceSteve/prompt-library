import baseManifest from './manifest.base.json' with { type: 'json' };

export const browserTargets = ['chrome', 'firefox', 'safari'] as const;
export type BrowserTarget = (typeof browserTargets)[number];
export const FIREFOX_ID = 'prompt-library@extensions.invalid';

export function parseTarget(value: string): BrowserTarget {
  if (!browserTargets.includes(value as BrowserTarget)) {
    throw new Error(
      `Unknown browser "${value}". Choose chrome, firefox, or safari.`,
    );
  }
  return value as BrowserTarget;
}

export function targetConfig(target: BrowserTarget) {
  return {
    // Keep Chrome's installed path and its local extension identity stable.
    outDir: target === 'chrome' ? 'dist' : `build/${target}`,
    jsTarget: {
      chrome: 'chrome120',
      firefox: 'firefox140',
      safari: 'safari17',
    }[target],
    backgroundFile: target === 'chrome' ? 'service-worker.js' : 'background.js',
  };
}

export function createManifest(target: BrowserTarget) {
  const common = structuredClone(baseManifest);
  const backgroundFile = targetConfig(target).backgroundFile;
  if (target === 'chrome') {
    return {
      ...common,
      permissions: [...common.permissions, 'offscreen'],
      minimum_chrome_version: '120',
      background: { service_worker: backgroundFile, type: 'module' },
    };
  }
  const background = {
    scripts: [backgroundFile],
    persistent: false,
    type: 'module',
  };
  if (target === 'firefox') {
    return {
      ...common,
      background,
      browser_specific_settings: {
        gecko: {
          id: FIREFOX_ID,
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    };
  }
  return {
    ...common,
    background,
    browser_specific_settings: { safari: { strict_min_version: '17.0' } },
  };
}
