import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    maxConcurrency: 1,
  },
});
