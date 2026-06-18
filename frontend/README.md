# OpenFarmPlanner Frontend

React + TypeScript frontend for OpenFarmPlanner.

This README covers frontend-specific development details. For the full project overview, start at the root [`README.md`](../README.md).

## Stack

- React 19
- TypeScript
- Vite
- Material UI
- React Router
- Vitest + Testing Library
- Playwright (E2E)

## Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Local app URL: `http://localhost:5173/`

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
npm run test:coverage
npm run test:e2e
npm run test:e2e:headed
```

## API Integration

- Set `VITE_APP_ENV` explicitly to `development`, `staging`, or `production`.
- Development and staging show detailed runtime error diagnostics; production uses the user-friendly error screen.
- Service workers are disabled and stale registrations are removed in development.
- Frontend API client targets `/api` by default.
- In development, `VITE_API_BASE_URL` can override the API base URL.
- Requests include credentials and CSRF token handling for write operations.
- Active project context is sent via `X-Project-Id` when available.

## Internationalization

- UI strings are managed through i18n resource files under `src/i18n/locales/`.
- Keep UI text in translation resources rather than inline strings whenever practical.

## Deployment Notes

The app uses Vite code splitting and hashed frontend assets. When a new build is deployed, existing browser sessions can still reference chunk URLs from the previous build. The runtime handler in `src/runtime/chunkLoadErrors.ts` catches missing dynamic imports, reloads once per session window, and then shows a manual reload action if the chunk is still unavailable.

Vite clears the build output directory by default before writing a new build unless `emptyOutDir` is changed. Deployment details live in the separate ops repository, but if production deployment removes old hashed assets immediately, the runtime handler is still required. Keeping old `assets/` files available for a short grace period during deploys further reduces missing-chunk errors for active sessions.

## End-to-End Tests

See [`e2e/README.md`](./e2e/README.md) for Playwright-specific details.
