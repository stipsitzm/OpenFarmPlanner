import { defineConfig, devices } from '@playwright/test';

const frontendPort = process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT) : 4173;
const backendPort = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 8000;
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
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: `bash -lc 'uv run python manage.py migrate && uv run python manage.py runserver 127.0.0.1:${backendPort}'`,
      cwd: '../backend',
      port: backendPort,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        DEBUG: 'True',
        // Without a local .env file (e.g. in CI), DJANGO_ENV defaults to 'production',
        // and settings.py refuses to boot with a localhost FRONTEND_URL in that mode.
        DJANGO_ENV: process.env.DJANGO_ENV || 'development',
        FRONTEND_URL: `http://127.0.0.1:${frontendPort}`,
        CORS_ALLOWED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
        CSRF_TRUSTED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
        E2E_TEST_TOKEN: e2eToken,
      },
    },
    {
      // Serves the production bundle (`npm run build`'s dist/ output), not the Vite dev
      // server, so E2E tests catch build-only bugs (e.g. effect-ordering/timing issues
      // that only surface once code is bundled) instead of just dev-mode behavior.
      // `dist/` must already exist — run `npm run build` first (see package.json's
      // `test:e2e` script and the CI workflow).
      command: `npm run preview -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      cwd: '.',
      port: frontendPort,
      reuseExistingServer: true,
      timeout: 30_000,
      env: {
        ...process.env,
        DEV_BACKEND_ORIGIN: `http://127.0.0.1:${backendPort}`,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
