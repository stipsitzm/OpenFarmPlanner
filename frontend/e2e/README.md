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


## Responsive screenshot baseline

Run responsive visual baselines:

```bash
cd frontend
npx playwright test e2e/responsive-layouts.spec.ts
```

Update screenshots intentionally:

```bash
cd frontend
npx playwright test e2e/responsive-layouts.spec.ts --update-snapshots
```

Notes:
- Viewports covered: `375x800`, `768x900`, `1024x900`, `1440x900`.
- Route coverage: dashboard, standorte, anbauflaechen, kulturen, anbauplaene, anbaukalender, saatgutbedarf, lieferanten.
- Helpers are in `e2e/utils.ts` for deterministic login, viewport presets, and stable-page waiting.
