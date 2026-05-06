import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'
  },
  webServer: process.env.E2E_SKIP_WEBSERVER === '1' ? undefined : {
    command: 'pnpm --filter @eyther/web dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
