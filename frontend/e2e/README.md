# E2E tests

This directory contains Playwright end-to-end tests for the invitation flow.

## Run locally

```bash
npm run test:e2e
```

The Playwright config starts both the Django backend and the Vite frontend automatically.
A debug-only backend fixture endpoint is enabled only when `DEBUG=True` and `E2E_TEST_TOKEN` is configured by the Playwright web server environment.
