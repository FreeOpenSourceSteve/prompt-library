import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'config/**/*.test.ts',
      'tests/build/**/*.test.ts',
    ],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/background/library-service.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { statements: 85, branches: 75, functions: 90, lines: 85 },
    },
  },
});
