# Regression Analysis — Graphic View Bed Scaling and Related Issues

**Date:** 2026-06-23
**Branch:** codex/refine-fields-empty-state

---

## Background

The branch `codex/refine-fields-empty-state` diverged from `main` at commit `18b3fddb` (Merge PR #231).
A stash merge commit `a5fb7628` ("chore: merge stash and resolve conflicts after rebase") brought in
working-tree changes from main but **did not include** commits that were already merged to main on a
separate branch. The `586e1b7b` fix ("fix: preserve small bed layout proportions") is one such commit.

---

## Regression 1: Bed scaling — two beds with different dimensions rendered at same size

### Symptom
On the Fields → Graphic view page, a 0.5 m × 0.5 m bed and a 1.0 m × 1.0 m bed render at the same
pixel size. Proportionality between bed sizes is completely lost for small beds.

### Affected file
`frontend/src/pages/graphicalLayoutUtils.ts`

### Root cause
The functions `getBedRectSize` and `getBedRectSizeWithinField` apply a hard floor of 20 px to both
width and height via `Math.max(20, Math.round(...))`. For small beds at typical zoom levels, both a
0.5 m and a 1.0 m bed compute to a value below 20 px and are therefore both clamped to 20 px,
making them visually identical.

In addition, `getBedRectSize` did not guard against `length_m === 0` or `width_m === 0` values,
which could cause the dimensional path to produce a zero-size rect when field dimensions are missing.

### Original fix commit
`586e1b7b` — "fix: preserve small bed layout proportions" (2026-06-16)
- Removed `Math.max(20, Math.round(...))` from both functions
- Added `> 0` guard for `bed.length_m` and `bed.width_m` before taking the dimensional path
- Returned raw floating-point `bed.width_m * pxPerMeter` to preserve proportions precisely

### Regression commit
`a5fb7628` — "chore: merge stash and resolve conflicts after rebase" (2026-06-22)
The stash merge pulled in stashed working-tree changes but the branch had diverged from main and
`586e1b7b` was never cherry-picked or rebased in. The file returned to the version from before
`586e1b7b` was authored.

### Restoration applied
Restored the two changes from `586e1b7b` directly:
1. `getBedRectSize`: changed condition to also require `> 0`, removed `Math.max(20, Math.round(...))`,
   return `bed.width_m * pxPerMeter` and `bed.length_m * pxPerMeter` directly.
2. `getBedRectSizeWithinField`: removed `Math.max(20, Math.round(...))` from the inner return,
   return `bedWidthM * pxPerMeterX` and `bedLengthM * pxPerMeterY` directly.
3. Re-added 5 test cases from `586e1b7b` that verify proportionality for small beds.

### Verification
- `npx vitest run src/__tests__/graphicalLayoutUtils.test.ts` — 13/13 tests pass
- `npx vitest run` — 758/758 tests pass
- `npx tsc --noEmit` — no errors

---

## Previously Fixed Regressions (do not redo)

### Suppliers hover-action icons
**Fixed in:** `61a63d64` — "fix: restore hover-only action icons in Suppliers table"
**Caused by:** `a5fb7628` and `ecaaff16`
**Status:** Already committed. No further action needed.

---

## Other Observations from Stash Merge (`a5fb7628`)

The stash merge introduced the following changes that appear intentional and not regressions:

- `DataGrid.tsx`: Re-enabled `useNavigationBlocker(hasUnsavedChanges, ...)` (was previously disabled
  with `false`). This is a restoration of correct navigation-blocking behavior.
- `FieldsBedsHierarchy.tsx`: Added `isAnyRowInEditMode` navigation blocker, improved dimension
  validation to also reject non-numeric input, removed `secondary` prop from `ContextMenuHint`.
- `GraphicalFields.tsx`: Added auto-expansion of all locations on first load
  (`hasAutoExpanded` state + `useEffect`).
- `Suppliers.tsx`: Removed `secondary` prop from `ContextMenuHint`.

These are all net improvements and are not regressions.

---

## Summary of Changes Made in This Investigation

| File | Change |
|------|--------|
| `frontend/src/pages/graphicalLayoutUtils.ts` | Restored proportional bed sizing (no 20 px floor, `> 0` guard) |
| `frontend/src/__tests__/graphicalLayoutUtils.test.ts` | Restored 5 proportionality test cases |
