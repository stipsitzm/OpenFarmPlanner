# Agent Guidelines for React Modern Gantt

## Project intent
- This repository is a **TypeScript React library** (`react-modern-gantt`), not an app-first codebase.
- Keep changes focused on reusable library behavior in `src/`.
- The `example/` folder is a demo playground and should only be updated when a feature needs visual demonstration.
- This repo is a fork (`origin` = `stipsitzm/React-Modern-Gantt`) of `upstream` (`MikaStiebitz/React-Modern-Gantt`). Push to `origin` only; never push to `upstream` unless explicitly asked.

## Language Rules
- All code, comments, docstrings, identifiers, and commit messages must be in English.
- Do not mix German and English within code.
- User-facing text in the library itself must go through the `locale` / `localeText` props, not hardcoded strings (see Localization below). This only applies to the demo app under `example/`, which may use plain text for illustration.

## General Guidelines
- Follow the existing project structure and established patterns.
- Prefer consistency over introducing new patterns.
- Keep type safety strict; avoid unnecessary `any`.
- Keep functions small, focused, and readable.
- Reuse existing components/services/utilities before creating new abstractions.
- Avoid duplication (DRY) — logic that must produce the same result in two places (e.g. `TaskList` and `TaskRow` height calculations) belongs in one shared function, not two copies that can drift apart.
- Refactor when repeated or diverging patterns appear; prefer extracting shared helpers over copy-pasting.
- Prefer small, reviewable, targeted edits; avoid broad refactors unless explicitly requested.

## Architecture and file layout
- Public entrypoint: `src/index.ts`.
  - Maintain backward compatibility for exports and default export behavior.
  - Do not remove or rename exported types/components/utilities without a strong reason.
- Core rendering split:
  - `src/components/core/` for `GanttChart`
  - `src/components/task/` for task list/rows/items
  - `src/components/timeline/` for timeline headers/markers
  - `src/components/ui/` for UI helpers (tooltips, selectors, export controls)
- Shared logic:
  - `src/services/` for positioning/collision/export/business logic
  - `src/utils/` for date/find/position/hierarchy-label helpers
  - `src/types/` for public and internal TypeScript contracts

## Architecture Safety Rules
- Before introducing a new component, hook, utility, or abstraction: first check whether a similar solution already exists in `src/services/` or `src/utils/`.
- Avoid parallel implementations of the same concept (e.g. two components independently re-deriving the same layout math).
- Prefer extending existing systems over creating alternatives.
- Preserve existing UX behavior unless explicitly changing it.

## API and compatibility rules
- Treat `Task`, `TaskGroup`, and component prop interfaces as part of the public API.
- Additive changes are preferred (optional props/fields) over breaking changes.
- Preserve existing behavior for generic consumers when adding integration-specific enhancements.

## React + TypeScript conventions in this repo
- Follow existing functional component patterns and prop typing style.
- Use PascalCase for component names and `useSomething` for hooks.
- Do not add `try/catch` around imports.
- Keep render logic readable; extract small helper functions only when it improves clarity.

## UI/Rendering specifics to respect
- Left task list (`TaskList`) and timeline rows (`TaskRow`) must stay visually aligned; row-height and label-height logic between them is shared via `src/utils/hierarchyLabel.ts` — update both consumers together if it changes.
- Preserve overflow/ellipsis behavior for compact labels.
- Tooltip behavior supports portal rendering and inline rendering (`renderTooltipInPortal`); do not break either mode.
- Sticky headers, infinite scroll, and drag interactions are core features; avoid side effects in unrelated areas.
- Dark mode styles exist in `src/styles/gantt.css`; update both default and dark selectors when adjusting visual hierarchy.

## Localization and text
- Localization is supported through `locale` and `localeText` props.
- Avoid hardcoding user-facing text when a localized prop already exists.
- For date-sensitive tests, avoid assumptions tied to the current real date.

## Testing Rules
- For logic or rendering behavior changes, update/add Jest tests in `__tests__/`.
- For bug fixes, prefer a regression-style test that fails before the fix.
- Keep tests deterministic (avoid current-date flakiness by setting explicit dates/currentDate where needed).
- Run targeted tests (`npx jest <pattern>`) when appropriate unless the user explicitly says not to run tests.
- Do NOT trigger or execute GitHub Actions workflows manually.

## Refactoring Rules
- If code duplication or diverging copies of the same logic appear, suggest (or do) a refactor.
- Prefer extracting shared components/utilities over copy-pasting.
- Keep refactors incremental and low-risk; verify with `tsc --noEmit`, `npm run lint`, and `npm test` after.

## Documentation Rules
- Update relevant documentation (README, CHANGELOG) when public behavior changes.
- Keep code comments minimal and useful; prefer self-explanatory code.
- Update this file only when project architecture or developer workflow changes significantly, not for small implementation details.

## CI
- GitHub Actions (`.github/workflows/ci.yml`) runs `npm test` on every pull request (not on plain pushes to a branch).
- Keep workflows minimal and reliable: install dependencies, run tests, optionally lint/build when appropriate.
- Avoid introducing new toolchains for CI.

## Commit Style
- Keep commit messages concise and imperative (e.g. "Fix hierarchy demo mode toggle"); a `type:` prefix (`feat:`, `fix:`, `ci:`) is used occasionally but not required project-wide — match the style of nearby history rather than enforcing strict Conventional Commits.
