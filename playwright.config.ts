import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  retries: 2,
  // Arrancar automáticamente frontend y backend para las pruebas E2E
  webServer: [
    {
      command: 'npm run dev --prefix pos-system/frontend',
      url: 'http://localhost:5177',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm run dev --prefix pos-system/backend',
      url: 'http://localhost:5757',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL: 'http://localhost:5177',
    acceptDownloads: true,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/.last-run.json' }],
    ['line'],
  ],
});
