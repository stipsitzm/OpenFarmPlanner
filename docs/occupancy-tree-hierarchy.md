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
