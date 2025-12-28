# Copilot Instructions (Repository-wide)

This repository has two main parts:

- Backend: Python (Django, managed with PDM)
- Frontend: React + TypeScript (Vite)

All comments, docstrings, logs, and output messages must be written in English.

For specific coding rules, see:

- `./instructions/python-backend.md`
- `./instructions/react-frontend.md`

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
