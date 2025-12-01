import { defineConfig } from '@playwright/test'

export default defineConfig({
  fullyParallel: false,
  workers: 2,
  use: {
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  timeout: 30000,
})

