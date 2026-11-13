import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/webkit',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    browserName: 'webkit',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 440, height: 600 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
