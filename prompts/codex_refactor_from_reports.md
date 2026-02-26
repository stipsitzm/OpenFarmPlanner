# Codex prompt: Refactor from quality reports

Read all files under `reports/latest/` and produce:

1. A prioritized refactor plan grouped by **impact** and **risk**.
2. A short PR roadmap (PR1, PR2, PR3).

Rules:
- Prioritize issues reported by Ruff, Radon, ESLint, and Madge.
- Focus on maintainability and correctness first, style second.
- Keep behavior unchanged unless explicitly requested.
- Identify quick wins separately from deep refactors.

Then implement **PR1 only** with small, review-friendly commits, and include before/after snippets from the report files in the PR description.
