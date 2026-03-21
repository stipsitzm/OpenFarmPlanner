import { defineConfig, devices } from '@playwright/test';

const frontendPort = 4173;
const backendPort = 8000;
const e2eToken = process.env.E2E_TEST_TOKEN || 'openfarmplanner-e2e-token';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}/openfarmplanner`,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: "bash -lc 'uv run python manage.py migrate && uv run python manage.py runserver 127.0.0.1:8000'",
      cwd: '../backend',
      port: backendPort,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        DEBUG: 'True',
        FRONTEND_URL: `http://127.0.0.1:${frontendPort}/openfarmplanner`,
        CORS_ALLOWED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
        CSRF_TRUSTED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
        E2E_TEST_TOKEN: e2eToken,
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`,
      cwd: '.',
      port: frontendPort,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: `http://127.0.0.1:${backendPort}/openfarmplanner/api`,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
