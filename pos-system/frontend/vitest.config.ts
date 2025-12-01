import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    watch: false,
    reporters: ['default'],
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    maxConcurrency: 1,
    sequence: { concurrent: false },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    coverage: { enabled: false },
    setupFiles: ['src/test/setup.ts'],
    exclude: [
      'node_modules/**',
      'e2e/**/*',
      'playwright-report/**/*',
      'tests/e2e/**/*'
    ],
    isolate: true,
  },
})
