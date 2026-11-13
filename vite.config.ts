import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createManifest, parseTarget, targetConfig } from './config/targets.ts';

export default defineConfig(({ mode }) => {
  const browser = parseTarget(
    mode === 'production' || mode === 'development' ? 'chrome' : mode,
  );
  const target = targetConfig(browser);
  return {
    plugins: [
      react(),
      {
        name: 'extension-manifest',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'manifest.json',
            source: JSON.stringify(createManifest(browser), null, 2) + '\n',
          });
        },
      },
    ],
    base: './',
    build: {
      target: target.jsTarget,
      outDir: target.outDir,
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          library: fileURLToPath(new URL('./index.html', import.meta.url)),
          popup: fileURLToPath(new URL('./popup.html', import.meta.url)),
          ...(browser === 'chrome'
            ? {
                clipboard: fileURLToPath(
                  new URL('./clipboard.html', import.meta.url),
                ),
              }
            : {}),
          background: fileURLToPath(
            new URL('./src/background/index.ts', import.meta.url),
          ),
        },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === 'background'
              ? target.backgroundFile
              : 'assets/[name]-[hash].js',
        },
      },
    },
  };
});
