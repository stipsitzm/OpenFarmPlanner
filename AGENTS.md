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
- Prefer type safety, including TypeScript types and Python type hints.
- Keep functions small, focused, and readable.
- Write clean, maintainable, and well-structured code.

## Commit and PR Title Rules (AI Agents)
- All commit messages and PR titles must use Conventional Commits.
- Use only these prefixes: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.
- Do not use free-form prefixes such as `Invitation`, `Update`, `Improvement`, `Changes`, `Misc`, or `Work in progress`.
- PR titles are validated separately by GitHub Actions and must follow the same Conventional Commit format as commit messages.
- Choose type by impact: `feat` for new functionality, `fix` for behavior corrections, `refactor` for internal restructuring, `docs` for documentation, `test` for tests, `ci/build/chore` for tooling and maintenance, `perf` for performance improvements.
- Use `feat` and `fix` only when release-triggering version changes are intended.
