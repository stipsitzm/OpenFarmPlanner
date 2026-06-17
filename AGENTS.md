# AGENTS.md

## Language Rules
- All code must be written in English.
- All comments and docstrings must be in English.
- All variable names, function names, class names, and identifiers must be in English.
- All commit messages must be written in English.
- All API responses and application logs must be in English.
- All explanations, summaries, and code-related output from AI agents must be in English.
- UI text must remain in German and must be handled through i18n resources.
- Do not mix German and English within code.

## General Guidelines
- Follow the existing project structure and established patterns.
- Prefer consistency over introducing new patterns.
- Prefer type safety, including TypeScript types and Python type hints.
- Keep functions small, focused, and readable.
- Write clean, maintainable, and well-structured code.
- Reuse existing components before creating new abstractions.
- Avoid duplication (DRY).
- Refactor when repeated patterns appear.
- Prefer centralized solutions over page-specific fixes.

## Testing Rules
- Write or update appropriate tests for functional changes.
- New features should include tests for expected behavior.
- Bug fixes should include regression tests where possible.
- Behavior changes must update affected frontend, backend, or end-to-end tests where the repository already has coverage patterns.
- Prefer extending existing test files before creating new test structures.
- Follow existing test patterns used in the repository.
- Run targeted tests when appropriate unless the user explicitly says not to run tests.
- Do NOT execute CI workflows manually.

## Documentation Rules
- Update relevant documentation when behavior changes.
- Keep code comments minimal and useful.
- Prefer self-explanatory code over comments.
- Update AGENTS.md only when project architecture or developer workflow changes significantly.
- Do not update AGENTS.md for small implementation details.

## Project Structure
- `backend/` contains the Django backend. The main apps are `accounts/` and `farm/`, with project settings in `config/`, app-local tests under each app, backend helper scripts in `backend/scripts/`, and generated media under `backend/media/`.
- `frontend/` contains the React + TypeScript app. Application code lives in `frontend/src/`, with pages, components, hooks, API clients, i18n resources, and frontend tests following the existing folder layout. Playwright end-to-end tests live in `frontend/e2e/`.
- `tests/` contains repository-level Python tests that are not tied to a single Django app.
- `scripts/` contains repository-level helper and maintenance scripts.
- `docs/` contains project documentation.
- `prompts/` contains saved prompt material used by the project.
- `.github/` contains GitHub Actions workflows and GitHub instruction files.

Follow existing placement patterns before creating new directories.

## Frontend Rules
- UI text must always use i18n resources.
- Never hardcode user-visible strings directly into components, dialogs, tables, filters, tooltips, snackbars, or form helpers.
- New or changed UI text must include German translations in the relevant i18n namespace.
- Never render raw enum values, backend field names, or technical API error payloads directly in the UI. Map them to user-friendly localized labels or messages first.
- Prefer reusable components over page-local implementations.
- Reuse existing layout and topbar patterns.
- Maintain responsive behavior.
- Avoid layout shifts during state changes.
- Use TypeScript for frontend code; do not introduce plain JavaScript where TypeScript is possible.
- Use PascalCase for component names and `useSomething` names for hooks.
- Prefer strongly typed props and avoid `any`.
- Avoid deprecated MUI APIs; use current patterns such as `slotProps.htmlInput` instead of `inputProps`.

## UI Consistency / OpenFarmPlanner Style
- When creating or modifying UI elements, always follow the existing OpenFarmPlanner design language.
- This applies especially to info boxes, warning boxes, validation messages, confirmation dialogs, empty states, snackbars and undo messages, context menus, hover actions, buttons, tables, DataGrid behavior, forms, and helper texts.
- Search the codebase for existing implementations before creating new UI patterns.
- Reuse shared components and established patterns whenever possible.
- Do not introduce new colors, spacing, icons, typography, border styles, or interaction patterns if an equivalent OpenFarmPlanner pattern already exists.
- Prefer extending an existing shared component over creating a page-specific variant.
- If several similar implementations exist, prefer the one used most consistently across the app.
- Keep wording, button order, severity levels, and interaction behavior consistent with comparable existing screens.
- Prefer making behavior consistent across the application rather than optimizing a single page in isolation.

## Backend Rules
- Backend packages are managed with PDM. Use `pdm` commands and do not introduce `pip install`, `requirements.txt`, or `setup.py`.
- Follow PEP 8.
- Use Python type hints everywhere.
- New or changed Python functions and methods should include complete parameter and return type hints.
- Keep views thin.
- Put business logic into services where appropriate.
- Avoid database writes inside GET endpoints.
- Keep API responses predictable and stable.
- Use SI units internally for physical measurements stored in the database, and convert units only at system boundaries such as serializers, forms, or API layers.
- Document physical units in model `help_text`, docstrings, or API/schema descriptions where units are not obvious.

## GitHub Push Workflow
- This repository should use the SSH GitHub remote:
  `git@github.com:stipsitzm/OpenFarmPlanner.git`
- If origin uses HTTPS and a push is requested, switch to SSH.
- Assume SSH works unless push errors indicate otherwise.

## Commit and PR Title Rules

- Use Conventional Commits only:
  feat
  fix
  docs
  refactor
  test
  chore
  ci
  build
  perf

- Use feat/fix only for user-visible changes.
- Use refactor for structural changes without behavior changes.
- Keep commit and PR titles concise.

## Architecture Safety Rules
- Before introducing a new component, hook, utility, context, or abstraction:
  first check whether a similar solution already exists.
- Avoid parallel implementations of the same concept.
- Prefer extending existing systems over creating alternatives.
- Preserve existing UX behavior unless explicitly changing it.

## Shared Components
- When modifying shared components, assume the change can affect multiple pages.
- Shared components include DataGrid wrappers, table components, dialog components, form components, navigation components, shared hooks, and utility functions used by multiple pages.
- Search for usages across the project before making changes.
- Consider the impact on all affected pages.
- Avoid breaking existing workflows.

## Refactoring Rules
- If code duplication appears in multiple places, suggest refactoring.
- Prefer extracting shared components over copy-pasting.
- Keep refactors incremental and low-risk.

## Regression Prevention
- Search for similar implementations before making a change.
- Preserve existing behavior unless explicitly requested otherwise.
- Prefer local fixes over large refactorings.
- Consider both desktop and mobile behavior.
- Consider keyboard navigation (Enter, Escape, Tab, Shift+Tab, Arrow Keys), context menu interactions, and touch interactions.
- Keep behavior consistent with existing pages.
- When modifying an existing feature, review all places using the same pattern.
- If the same bug exists in multiple locations, fix all occurrences.
- Do not introduce special-case behavior unless explicitly requested.

## UX Consistency Rules
- Empty states should guide users toward the next action.
- Prefer contextual actions over disabled controls.
- Keep styling and interaction patterns consistent across pages.
- Reuse existing empty-state, dialog, and topbar patterns.
- Enter saves changes where expected; Escape cancels editing where expected.
- Tab and Shift+Tab navigation remain consistent across all pages.
- Desktop and mobile behavior remain aligned.
- Context menu functionality remains consistent across pages.
- Similar tables should behave the same way.

## Verification Checklist
After implementing a change, verify:
- Existing workflows still work.
- Saving still works.
- Keyboard navigation still works.
- Context menus still work.
- Mobile layouts still work.
- No obvious regression was introduced.
