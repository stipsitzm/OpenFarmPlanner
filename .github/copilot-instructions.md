# Copilot Instructions (Repository-wide)

This repository has two main parts:

- Backend: Python (Django, managed with PDM)
- Frontend: React + TypeScript (Vite)

All comments, docstrings, logs, and output messages must be written in English.

## Comment Style

- Keep comments and docstrings concise and single-line whenever possible.
- Avoid verbose attribute lists in class docstrings; prefer a short summary sentence.
- Apply this especially to Django model classes and their methods.

For specific coding rules, see:

- `./instructions/python-backend.instructions.md`
- `./instructions/react-frontend.instructions.md`

## Django Migrations

**NEVER edit an existing migration file once it has been created.**  Migrations
may already be applied to production or developer databases.  Editing an applied
migration causes migration state to diverge from the actual schema and makes
rollbacks break (e.g. `DuplicateColumn` errors when Django tries to add back a
column that was never actually dropped).

- Always create a **new** migration for any further schema change.
- If a schema fix is needed after an already-applied migration, create a new
  "fix" migration.  Use `RunSQL` with `ALTER TABLE … DROP COLUMN IF EXISTS` (or
  the equivalent safe DDL) so that the operation is idempotent and does not fail
  whether or not the column is already absent.
- For the reverse of such a fix migration, use a no-op (`SELECT 1;`) rather than
  trying to recreate deprecated columns.
- Use `SeparateDatabaseAndState` to keep Django's migration state in sync when
  the raw SQL already covers the database change.

## Commit Messages (Conventional Commits)


Commit messages must always be written in English.

Always use the format:

`type(scope): short description`

Common types:

- feat – new feature
- fix – bug fix
- refactor – refactoring without behavior change
- perf – performance improvement
- docs – documentation only
- style – formatting, no logic change
- test – tests only
- build – build system, tooling, dependencies
- ci – CI-related changes
- chore – maintenance, housekeeping
- revert – revert previous commit

Examples:

- `feat(crop-planner): add crop filtering by planting date`
- `fix(api): correct timezone conversion for harvest dates`
- `docs: update setup instructions for PDM`
- `refactor(frontend): extract useCrops hook`
- `test(backend): add tests for yield calculation`

If a breaking change is introduced, include a `BREAKING CHANGE:` note in the commit body or footer, explaining what changed and required follow-up actions.
