import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  retries: 0,
  // No arrancar servidores; usamos URLs absolutas (8080) para status dashboard
  use: {
    baseURL: 'http://localhost:8080',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['html', { open: 'never' }], ['line']],
});
