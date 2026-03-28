# Contributing

## Conventional Commits

This project uses Conventional Commits for automated versioning and releases.

All **commit messages** and **PR titles** must follow:

`type(scope): description`

Examples:

- `feat(crop-planner): add crop filtering by planting date`
- `fix(api): correct timezone conversion for harvest dates`
- `docs: update setup instructions for PDM`
- `refactor(frontend): extract useCrops hook`
- `test(backend): add tests for yield calculation`

### Allowed types

- `feat` – new user-visible feature
- `fix` – bug fix affecting behavior
- `refactor` – refactoring without behavior change
- `perf` – performance improvement
- `docs` – documentation only
- `style` – formatting, no logic change
- `test` – tests only
- `build` – build system or dependencies
- `ci` – CI-related changes
- `chore` – maintenance tasks
- `revert` – revert previous commit

### How to choose the correct type

- Use `feat:` only for new user-visible functionality, new API endpoints, or UI features.
- Use `fix:` only for bug fixes, regressions, or incorrect behavior.
- Use `refactor:` for internal restructuring, renaming, or cleanup without behavior change.
- Use `docs:` for documentation-only changes.
- Use `test:` for test-only changes.
- Use `chore:`, `ci:`, `build:`, `style:`, `perf:` for maintenance, tooling, formatting, or performance-only work.

Important: do not use `feat:` or `fix:` unless the change should trigger a release.

### Breaking changes

Use either:

- `feat!: change API contract`

or include in the body:

- `BREAKING CHANGE: description`

### Release behavior

- `fix:` -> patch release
- `feat:` -> minor release
- `type!:` or `BREAKING CHANGE:` -> major release
- `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `style`, `perf` -> no release

## AI-assisted commits (Codex/Copilot)

When creating commits with AI assistance, ensure each commit message follows Conventional Commits.

Only correctly formatted commit messages can drive automated semantic releases.
