import { defineConfig } from '@playwright/test';

const e2ePort = 3107;
const e2eBaseUrl = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: e2eBaseUrl
  },
  webServer: process.env.E2E_SKIP_WEBSERVER === '1' ? undefined : {
    command: `pnpm --filter @eyther/web dev --hostname 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
