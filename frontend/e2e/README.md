# Frontend E2E Tests

Playwright end-to-end tests for OpenFarmPlanner frontend flows.

## Run

```bash
cd frontend
npm run test:e2e
```

## Notes

- The Playwright configuration starts the backend and frontend web servers automatically.
- A debug-only backend fixture endpoint is available only when:
  - `DEBUG=True`
  - `E2E_TEST_TOKEN` is set for the backend process started by Playwright

See `frontend/playwright.config.ts` for exact runtime settings.
