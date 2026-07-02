# Standort → Parzelle → Beet tree in the occupancy calendar

## Where the code lives

| Piece | Location | Generic or OFP-specific |
|---|---|---|
| Tree flattening (`flattenTreeRows`, `collectVisibleIdsWithAncestors`) | `frontend/src/components/hierarchy/utils/treeRows.ts` | **Generic.** Only knows `{id, parentId}`. No farm vocabulary, no MUI, no Gantt import. |
| Expand/collapse state (`useExpandedState`) | `frontend/src/components/hierarchy/hooks/useExpandedState.ts` | **Generic.** Set-based, sessionStorage-backed. Already shared with `FieldsBedsHierarchy.tsx` (DataGrid tree) and `GraphicalFields.tsx` (canvas view) — this is the third consumer. |
| Chevron/indent/collapse rendering, `depth`/`isExpandable`/`isExpanded`/`emptyRowLabel` on `TaskGroup` | `frontend/src/gantt-chart/src/{types,components/task}` | **Generic.** The vendored Gantt component only renders whatever depth/expand hints it's given via props; it has no notion of Standort/Parzelle/Beet. See `TaskList.tsx`'s `isTreeRow` branch and `TaskRow/index.tsx`'s `emptyRowLabel` handling. |
| Building the Standort → Parzelle → Beet node list (`buildFieldOccupancyHierarchy`) | `frontend/src/pages/ganttChartUtils.ts` | **OFP-specific.** Knows about locations/fields/beds/planting plans. |
| Wiring state, filters, search, default expansion | `frontend/src/pages/GanttChart.tsx` | **OFP-specific** (the page). Consumes only the generic pieces above. |

The dependency direction is one-way: `GanttChart.tsx` (app) → `ganttChartUtils.ts` (app) → generic `treeRows.ts` / `useExpandedState` / gantt-chart rendering hints. Nothing generic imports anything domain-specific.

## Data model

`buildFieldOccupancyHierarchy` returns a **flat list** of `OccupancyHierarchyNode` (`type: 'location' | 'field' | 'bed'`, `id`, `parentId`), not a nested breadcrumb string. This replaced the old `hierarchyPath: string[]` convention (`buildFieldOccupancyTaskGroups`, still present and tested for backward compatibility, but no longer used by the page) where every bed row carried its own copy of "Standort / Parzelle / Beet" as a joined label. Now Standort and Parzelle are real rows with their own identity, instead of text duplicated across every bed.

Unlike the old function, `buildFieldOccupancyHierarchy` includes **beds without any planting plan** — the "Nur belegte Beete" filter is what hides them, rather than them never existing in the data at all.

`GanttChart.tsx` turns this into the rows the Gantt library actually renders:

1. Apply the "Nur belegte Beete" structural filter (removes empty beds and any now-childless field/location ancestors) — independent of expand/collapse state.
2. If search text or a Standort/Parzelle filter is active, compute matched bed ids and expand that set to include all ancestors (`collectVisibleIdsWithAncestors`), so a matching bed's parent chain stays visible for context, bypassing collapse state.
3. `flattenTreeRows` turns the (pruned, possibly filtered) node list into ordered, depth-annotated visible rows, respecting `expandedRows` from `useExpandedState`.
4. Each visible row becomes a `GanttTaskGroup` with `depth`/`isExpandable`/`isExpanded` set and, for Standort/Parzelle rows, an `emptyRowLabel` summary string (bed/occupied/field counts).

That flat `GanttTaskGroup[]` is exactly what feeds into the existing `getGanttRenderWindow` scroll-virtualization (`ganttRenderWindow.ts`), unchanged — the tree is flattened into a flat array *before* windowing runs, so windowing doesn't need to know anything about the tree.

## Default expansion

Locations are always expanded by default. Fields are also expanded by default **unless** the combined location+field+bed node count exceeds `OCCUPANCY_TREE_AUTO_EXPAND_ALL_THRESHOLD` (30, in `GanttChart.tsx`), in which case fields start collapsed. This only applies once per project, on first load with no persisted expand state (`hasPersistedState` + a `hasInitiallyExpandedHierarchyRef` latch, mirroring the identical pattern already used by `FieldsBedsHierarchy.tsx`). After that, the user's manual expand/collapse choices persist via `useExpandedState`'s sessionStorage backing and survive both a page reload and switching the timeline view mode (day/week/month/quarter/year) or the occupancy/seedling calendar mode, since none of those remount the hook.

Small farms (the common case) see a fully expanded tree by default; large ones get a scannable, collapsed-by-default starting point.

## What's aggregated vs. not

Standort/Parzelle rows currently show a **meta-text summary** in place of bars (`emptyRowLabel`, e.g. "3 Parzellen · 12 Beete · 8 belegt") rather than an aggregate bar rolling up their descendants' planting-plan date ranges. This was a deliberate scope cut — implementing a generic "aggregate child date ranges into a parent bar" concept in the Gantt base component, without leaking farm-specific meaning into it, is a larger piece of work (deciding what "aggregate" means when children have overlapping or gapped ranges, how it renders at different zoom levels, etc.).

**Next step, if this is picked up later:** add an optional `aggregateTasks?: Task[]` (or a `renderEmptyRow?: (group) => ReactNode` render-prop, consistent with the library's existing `renderTask`/`renderTooltip` pattern) to `TaskGroup`, computed by `buildFieldOccupancyHierarchy` per Standort/Parzelle node from its descendant beds' task date ranges, and rendered by `TaskRow` in the same code path that currently renders `emptyRowLabel`.

## Filters and search

The filter bar (`GanttChart.tsx`, occupancy mode only) has: free-text search, a Standort `<Select>`, a Parzelle `<Select>` (populated from the selected Standort's fields, disabled until one is chosen), and a "Nur belegte Beete" checkbox (defaults to checked, matching the old always-hide-empty-beds behavior). Search matches a bed's own name, its field's name, its location's name, or any of its planting plans' culture names, case-insensitively. All of this is scoped to the occupancy view — the seedling/culture view keeps its existing flat, non-tree list.

## Tests

- `frontend/src/__tests__/treeRows.test.ts` — generic flatten/expand/collapse/filter mechanics, no OFP domain involved.
- `frontend/src/__tests__/ganttChartUtils.test.ts` (`describe('buildFieldOccupancyHierarchy', ...)`) — node construction, parent/child wiring, count aggregation, empty-bed inclusion.
- `frontend/src/__tests__/GanttChart.test.tsx` (`describe('occupancy tree filters and search', ...)`) — end-to-end: search reveals a match with parent context and hides unrelated branches, Standort filter reduces the tree, "Nur belegte Beete" toggles empty-bed visibility. The existing windowing/large-dataset test was updated to expand a field before asserting on scroll virtualization, since large trees now start with fields collapsed by design.
- `frontend/src/__tests__/GanttChart.test.tsx` (`describe('context navigation, double-click, and compact row heights', ...)`) — see "Context navigation" and "Row heights" below.

---

## Context navigation (right-click / long-press, double-click)

Added on top of the tree work above, as part of a broader calendar UX pass.

**Generic (gantt-chart library):**
- `TaskGroup.rowHeightOverride?: number` — lets a caller pin a specific row's height instead of the library's task-count-based computation. Honored by both `TaskList` (left column) and `TaskRow` (timeline row), so the two stay in sync. Unset = unchanged behavior.
- `GanttChartProps.onTaskDoubleClick?: (task, group) => void`, `onTaskContextMenu?: (event, task, group) => void`, `onGroupContextMenu?: (event, group) => void` — new event hooks on bars and tree rows. `onTaskDoubleClick` replaces the previously unused, dead `onTaskDoubleClick?: (task) => void` signature (it was destructured but never wired to anything). Right-click *and* a ~550ms long-press both fire the context-menu callbacks, matching the long-press pattern already used by `useHierarchyContextMenu.ts` in the Anbauflächen DataGrid tree.
- Hover-linking (`onGroupHoverChange`) is **not** part of the public API — it's wired entirely inside `GanttChart.tsx` (the library's core component): hovering a bar in `TaskRow` bubbles a `(groupId, isHovering)` change up, `GanttChart` holds `hoveredGroupId` state, and forwards it to `TaskList`, which sets `data-hover-linked="true"` on the matching row for a dezent CSS highlight (`gantt.css`). No app-level wiring needed.

**OFP-specific (`GanttChart.tsx`):**
- A single MUI `<Menu>` (same pattern as `FieldsBedsHierarchy.tsx`'s context menu: `anchorPosition`, grouped `MenuItem`s with `Divider`s between groups) driven by `getContextMenuActions(target)`, where `target` is either `{type: 'task', task, group}` or `{type: 'group', group}`.
- Task (bar) menu: Anbauplan öffnen, Kultur öffnen (if the task has a culture), Beet/Parzelle/Standort öffnen (if the enclosing group carries that id), then Bearbeiten / Zeile kopieren / Löschen. "Bearbeiten" currently opens the same planting-plans-filtered-by-bed view as "öffnen" — there's no dedicated single-plan edit deep link yet (see below). "Löschen" calls `plantingPlanAPI.delete` after a native `window.confirm`; this intentionally does **not** reuse the app's `DeleteUndoSnackbar` pattern to keep this change scoped — upgrading to it is a reasonable follow-up.
- Group (tree row) menu, based on which id the row's `GanttTaskGroup` carries (`bedId` → Beet actions incl. "Anbauplan hinzufügen"; `fieldId` only → Parzelle actions; `locationId` only → Standort actions).
- Double-click on a bar is a shortcut for "Anbauplan öffnen" — not edit, per the requirement that double-click should be a fast overview→detail jump, not an editing action.

**Known limitation, intentionally not implemented:** "Beet/Parzelle/Standort öffnen/bearbeiten" navigate to `/app/fields-beds` in general rather than to that specific row. `FieldsBedsHierarchy.tsx` doesn't currently support a `?focusBedId=`/`?focusFieldId=`/`?focusLocationId=` query param that would scroll to, select, and highlight a specific row. Adding that would be the natural next step (it would reuse the existing `ensureExpanded` from `useExpandedState` plus a scroll-into-view effect) but was left out here to avoid expanding this change into a second already-large file. Likewise, "Anbauplan öffnen/bearbeiten" navigates to `/app/planting-plans` filtered by `bedId`/`cultureId` (both already-supported query params) rather than opening one specific plan row directly — `PlantingPlans.tsx` has no `planId` deep-link today.

## Row heights

Standort and Parzelle rows (no bars of their own) get a fixed compact height (`OCCUPANCY_COMPACT_ROW_HEIGHT = 30` in `GanttChart.tsx`) via `rowHeightOverride`. Beet rows are left without an override, so they keep the library's normal height (driven by how many overlapping planting-plan bars need to stack). This is what lets significantly more of the tree fit on screen at once for farms with many locations/fields.

## Sidebar visual polish

`gantt.css`: consistent 16px chevron hit-area at every depth (previously 18px, inconsistently applied), depth-based font-weight/color progression (a lighter-weight, file-tree-like visual hierarchy instead of relying on indentation alone), and a new `.rmg-task-group-meta` class for the aggregate summary text (11px, dezent gray) shown directly under a Standort/Parzelle row's name — previously that summary only appeared in the timeline area (`emptyRowLabel` in `TaskRow`), not in the sidebar itself, where it reads more naturally (file-browser-style "12 items" under a folder name).

## Performance

`TaskItem`, `TaskRow`, and `TaskList` are now wrapped in `React.memo`, and the three task-interaction handlers in `GanttChart.tsx` (`handleTaskUpdate`, `handleTaskClick`, `handleTaskSelect`) are wrapped in `useCallback`. This was a targeted fix, not a blanket pass: before it, hovering a single bar (to drive the row hover-link above) would set `hoveredGroupId` state in the top-level `GanttChart` component, which — with zero memoization anywhere in the render tree — re-rendered *every* `TaskRow` and `TaskItem` in the chart on every mouseenter/mouseleave, regardless of dataset size. That's now scoped to just the rows whose actual props changed. Re-renders still legitimately cascade on expand/collapse, filter, and search changes (the visible row set itself changes then), which is expected and not something this pass tried to eliminate.

**Not done:** a full memoization audit of the rest of `GanttChart.tsx`'s internals (e.g. `renderGanttHeader`, the seedling-mode render paths) — those weren't touched by this change and weren't shown to be measurably slow; per "no premature micro-optimization," they were left alone.
