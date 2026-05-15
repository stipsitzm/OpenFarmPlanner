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
- Never hardcode German strings directly into components.
- Prefer reusable components over page-local implementations.
- Reuse existing layout and topbar patterns.
- Maintain responsive behavior.
- Avoid layout shifts during state changes.

## Backend Rules
- Use Python type hints everywhere.
- Keep views thin.
- Put business logic into services where appropriate.
- Avoid database writes inside GET endpoints.
- Keep API responses predictable and stable.

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

## Refactoring Rules
- If code duplication appears in multiple places, suggest refactoring.
- Prefer extracting shared components over copy-pasting.
- Keep refactors incremental and low-risk.

## UX Consistency Rules
- Empty states should guide users toward the next action.
- Prefer contextual actions over disabled controls.
- Keep styling and interaction patterns consistent across pages.
- Reuse existing empty-state, dialog, and topbar patterns.
