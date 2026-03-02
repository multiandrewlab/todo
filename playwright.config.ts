import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @muscat/backend dev',
      port: 8787,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'pnpm --filter @muscat/frontend dev',
      port: 5173,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
