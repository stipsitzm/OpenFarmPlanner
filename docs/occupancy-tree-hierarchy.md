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

The filter bar (`GanttChart.tsx`, occupancy mode only) has: free-text search, a Standort `<Select>`, a Parzelle `<Select>` (populated from the selected Standort's fields, disabled until one is chosen), and a "Nur belegte Beete" checkbox (defaults to checked, matching the old always-hide-empty-beds behavior). Search matches a bed's own name, its field's name, its location's name, or any of its planting plans' culture names, case-insensitively.

The seedling/Anzucht view has its own, much simpler filter bar: free-text search only (`seedlingSearchText`, matching a task group's culture name), no Standort/Parzelle `<Select>`s and no "Nur belegte Beete" checkbox, since that view is a flat, culture-grouped list with no bed/field/location hierarchy at all. Both search fields share one `searchInputRef`/`focusSearch()` pair — only one is ever mounted at a time (gated on `calendarMode`), so the ref always points at whichever field is currently visible. `Alt+S` (`calendar.focusSearch` command) focuses and selects whichever search field is active.

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
- Task (bar) menu: Anbauplan öffnen, Kultur öffnen (if the task has a culture), Beet/Parzelle/Standort öffnen (if the enclosing group carries that id), then Bearbeiten / Zeile kopieren / Löschen. "Anbauplan öffnen" (and double-click) navigate to `/app/planting-plans?planId=<id>` and just scroll to/select the row; "Bearbeiten" adds `&edit=true`, which additionally opens that row in inline edit mode straight away (`openPlantingPlanFromTask(task, { edit: true })` → `DataGrid`'s `openRowById(rowId, { startEdit: true })`). "Löschen" calls `plantingPlanAPI.delete` after a native `window.confirm`; this intentionally does **not** reuse the app's `DeleteUndoSnackbar` pattern to keep this change scoped — upgrading to it is a reasonable follow-up.
- Group (tree row) menu, based on which id the row's `GanttTaskGroup` carries (`bedId` → Beet actions incl. "Anbauplan hinzufügen"; `fieldId` only → Parzelle actions; `locationId` only → Standort actions).
- Double-click on a bar is a shortcut for "Anbauplan öffnen" — not edit, per the requirement that double-click should be a fast overview→detail jump, not an editing action.

**Deep links to the target row:** "Beet/Parzelle/Standort öffnen/bearbeiten" navigate to `/app/fields-beds?highlight=bed:<id>|field:<id>|location:<id>`. `FieldsBedsHierarchy.tsx` consumes that param: it expands the ancestor chain via the existing `ensureExpanded` (`useExpandedState`), scrolls the target row into view (`gridApiRef.getRowIndexRelativeToVisibleRows` + `scrollToIndexes`), and flashes it briefly (`ofp-hierarchy-row-highlighted`, a 2.5s CSS keyframe fade) so it's easy to spot in a long tree. "Anbauplan öffnen/bearbeiten" navigates to `/app/planting-plans?planId=<id>` (plus `&edit=true` for "bearbeiten") — `PlantingPlans.tsx` resolves that to the *existing* plan row (via the shared `EditableDataGridCommandApi.openRowById`, exposed generically off `DataGrid.tsx` for any page that needs to deep-link into an existing row, with an `{ startEdit }` option) and scrolls to/selects it — or opens it in edit mode straight away, for "bearbeiten" — instead of the earlier `bedId`/`cultureId` params, which always prefilled a brand-new draft row via `initialRow`: clicking "öffnen" on an existing task used to silently create a duplicate-looking blank plan rather than opening the one you clicked.

## Row heights

Standort and Parzelle rows (no bars of their own) get a fixed compact height (`OCCUPANCY_COMPACT_ROW_HEIGHT = 32` in `GanttChart.tsx`) via `rowHeightOverride`. Beet rows are left without an override, so they keep the library's normal, task-count-based height, computed from a `rowHeight={32}` prop (down from the library's default of 40) passed to `<GanttChartWithFocusMode>` plus reduced floors/padding in `hierarchyLabel.ts`'s `estimateLabelHeight` (60/+28 → 40/+20), `TaskList.getGroupHeight` (60/+20 → 40/+12), and `TaskRow`'s equivalent lane-height padding (+20 → +12) and bar vertical offset (+10 → +6). Together these noticeably shrink the sidebar/timeline row height for beds with only 1-2 stacked plans, without needing per-row overrides.

`TaskList` (sidebar) and `TaskRow` (timeline) are two independently-rendered sibling columns that both use CSS `minHeight` with the same numeric JS value — if their *content* differs enough that one side's minHeight gets exceeded and the other's doesn't, the two rows silently drift out of sync row-by-row. This bit us once already (see git history around `OCCUPANCY_COMPACT_ROW_HEIGHT`): watch for it whenever either side's row content changes.

## Sidebar visual polish

`gantt.css`: consistent 16px chevron hit-area at every depth (previously 18px, inconsistently applied), depth-based font-weight/color progression (a lighter-weight, file-tree-like visual hierarchy instead of relying on indentation alone). The Standort/Parzelle aggregate summary ("1 Parzelle · 8 Beete · 5 belegt") is **not** shown as a second visible sidebar line — it's folded into the row name's `title` attribute (hover tooltip) instead, via `TaskList.tsx`'s tree-row `<span>`. An earlier version rendered it as a separate `.rmg-task-group-meta` line; that turned out to both waste vertical space and be exactly the kind of two-line-vs-one-line content mismatch described above (it was the original cause of the sidebar/timeline row-misalignment bug), so it was removed in favor of the tooltip.

## Context menu vs. hover tooltip

Right-clicking a bar to open its context menu, while the mouse is still technically hovering it, used to leave the library's own hover tooltip visible underneath/overlapping the new menu. `TaskRow`'s `handleTaskContextMenu` now calls `setHoveredTask(null)` before forwarding the event, dismissing the tooltip immediately (mirrors what `handleTaskMouseLeave` already did).

## Drag-and-drop and optimistic updates

`GanttChart.tsx`'s `handleTaskUpdate` (the `onTaskUpdate` callback passed to the Gantt library) now updates local `plantingPlans` state optimistically, *before* `await`ing `plantingPlanAPI.update(...)`, then reconciles with the server response once it resolves (rolling back via `refreshPlantingPlans()` + a Gantt remount on failure, unchanged from before). Previously the state update only happened after the API call resolved: `TaskRow` clears its local drag/preview state as soon as the mouse is released, so for the ~50-300ms until the request resolved, the bar would re-render from the still-stale `plantingPlans` prop — visibly snapping back to its pre-drag position before jumping to the correct one once the response landed.

## Performance

`TaskItem`, `TaskRow`, and `TaskList` are now wrapped in `React.memo`, and the three task-interaction handlers in `GanttChart.tsx` (`handleTaskUpdate`, `handleTaskClick`, `handleTaskSelect`) are wrapped in `useCallback`. This was a targeted fix, not a blanket pass: before it, hovering a single bar (to drive the row hover-link above) would set `hoveredGroupId` state in the top-level `GanttChart` component, which — with zero memoization anywhere in the render tree — re-rendered *every* `TaskRow` and `TaskItem` in the chart on every mouseenter/mouseleave, regardless of dataset size. That's now scoped to just the rows whose actual props changed. Re-renders still legitimately cascade on expand/collapse, filter, and search changes (the visible row set itself changes then), which is expected and not something this pass tried to eliminate.

**Not done:** a full memoization audit of the rest of `GanttChart.tsx`'s internals (e.g. `renderGanttHeader`, the seedling-mode render paths) — those weren't touched by this change and weren't shown to be measurably slow; per "no premature micro-optimization," they were left alone.
