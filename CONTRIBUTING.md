# Contributing

## Commit message format (required)

This repository uses **Conventional Commits**.

Use one of these prefixes:

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `test:`
- `chore:`

Additional accepted technical types in CI:

- `ci:`
- `build:`
- `perf:`

### Release impact

- `fix:` -> **patch** release
- `feat:` -> **minor** release
- `feat!:` or any commit body containing `BREAKING CHANGE:` -> **major** release
- `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `build:` -> no release by default

Examples:

- `feat: add crop sharing between projects`
- `fix: restore field rendering after coordinate regression`
- `docs: document deployment workflow`
- `feat!: change planting plan API contract`

Breaking change in body example:

```text
feat: require project context for cultivation plans

BREAKING CHANGE: cultivation plan responses now require project context
```

## AI-assisted commits (Codex/Copilot)

When creating commits with AI assistance, ensure each commit message follows Conventional Commits.

Only correctly formatted commit messages can drive automated semantic releases.
