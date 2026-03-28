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

- Never modify an existing migration file after it is created.
- Always create a new migration for every follow-up schema change.
- If a previous migration needs correction, add a new fix migration instead of editing the old one.

## AI commit instructions

When generating commits or PR titles:

- Always use Conventional Commits.
- Use `type(scope): description` (scope optional).
- Commit messages and PR titles must always be in English.

Examples:

- `feat: add crop sharing`
- `fix: prevent duplicate entries`
- `refactor: simplify version endpoint`
- `docs: update deployment instructions`

Rules:

- Use `feat:` only for user-visible features.
- Use `fix:` only for bug fixes.
- Use `refactor:` for internal changes without behavior changes.
- Do not use `feat:` or `fix:` unless a release should be triggered.
- PR titles must follow the same format.

Release automation mapping:

- `fix:` -> patch release
- `feat:` -> minor release
- `type!:` or `BREAKING CHANGE:` -> major release
- `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `build:`, `style:`, `perf:` -> no release by default
