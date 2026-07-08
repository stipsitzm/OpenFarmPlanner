# TanStack Table + TanStack Virtual Spike

## Scope

This spike replaces only the Anbauflächen hierarchy table with a TanStack Table + TanStack Virtual prototype. It keeps the existing OpenFarmPlanner data model, API calls, hierarchy projection, expansion state, deletion undo, notes drawer, validation, and most shared hooks. The original MUI DataGrid implementation remains in `frontend/src/pages/FieldsBedsHierarchy.tsx` for review and rollback; the page imports the experimental implementation from `FieldsBedsTanStackHierarchy.tsx`.

The spike uses:

- `@tanstack/react-table` `^8.21.3`
- `@tanstack/react-virtual` `^3.14.5`

Both packages are open-source and permissively licensed.

## Implemented Prototype Features

- Standort -> Parzelle -> Beet hierarchy, rendered as an indented flat tree.
- Expand/collapse per row and one-level expand/collapse controls in the name header.
- Inline row editing for name, length, and width.
- Existing notes drawer integration.
- Existing delete-with-undo flow and row context menu.
- Sorting for `name` and `area_sqm` through the existing persisted sort model.
- Per-column text filters with ancestor rows kept visible for context.
- Column resizing through TanStack column sizing.
- Row virtualization through TanStack Virtual.
- Dynamic height that shrinks for small tables and fills available viewport space for larger tables.
- Keyboard navigation for row selection, expand/collapse, edit, delete, and context menu.
- Responsive behavior matching the existing mobile breakpoint and compact notes rendering.

## Known Gaps

- Inline editing is functional but less polished than the MUI DataGrid row-editing engine. The old implementation has deeper handling for cell-level focus restoration after Enter/Tab saves.
- Filter UI is intentionally simple text filtering. It does not reproduce MUI DataGrid's richer operator model.
- Sorting is limited to the fields already supported by the existing hierarchy sort model (`name`, `area_sqm`).
- Column resizing works, but autosize/content measurement is less mature than the current measured name-column logic.
- The implementation includes a jsdom-safe virtualizer fallback for tests. It is bounded to the first 80 rows only when TanStack Virtual has not produced virtual items yet.
- No Playwright screenshot baseline was added or updated. This is an experimental spike, and screenshot baselines should only be updated after explicit visual review.

## Development Effort

The prototype required a near full table-surface rewrite because TanStack Table is headless. Existing domain hooks could be reused, but keyboard behavior, virtual row layout, header/filter rows, context menu anchoring, column resizing, edit controls, and responsive sizing all had to be composed manually.

Code size comparison:

- Existing MUI DataGrid hierarchy table: `1,589` lines in `FieldsBedsHierarchy.tsx`.
- TanStack spike table: `1,627` lines in `FieldsBedsTanStackHierarchy.tsx`.
- Focused TanStack spike tests: `117` lines.

The result is not smaller than the current implementation because OpenFarmPlanner's required behavior is table-engine-heavy, not just row rendering.

## Code Complexity

TanStack separates row modeling from rendering. That is clean for simple tables, but the Anbauflächen table needs a lot of custom behavior:

- tree projection
- row-level editing
- persistent hierarchical expansion
- calculated area cells
- notes drawer integration
- undoable deletion
- focus and keyboard behavior
- dynamic viewport measurement
- filter behavior that keeps ancestors visible

Those pieces now live directly in the spike component. The complexity is explicit and controllable, but OpenFarmPlanner owns more of it.

## Readability

The TanStack version is readable for engineers comfortable with headless table composition. It avoids MUI DataGrid-specific APIs and makes the render tree visible in normal React code.

The downside is volume: behavior that DataGrid previously supplied or coordinated must be implemented in application code. Reading the spike requires understanding both TanStack state and OpenFarmPlanner's hierarchy hooks.

## Maintainability

Maintainability is mixed:

- Positive: no dependency on DataGrid internals for tree projection, focus hacks, or styling selectors.
- Positive: the rendering model is ordinary React and easier to customize.
- Negative: OpenFarmPlanner must maintain more table infrastructure itself.
- Negative: keyboard, editing, and virtualization edge cases become local responsibility.

For long-term use, this approach would need extraction into shared table primitives before migrating other pages.

## Performance

The prototype uses TanStack Virtual and renders only a visible window for large row counts once the scroll element is measured. The focused tests cover:

- small hierarchy default expansion
- large hierarchy initial collapsed bed rows
- per-column filtering with ancestor visibility

The build succeeded, and the UI is expected to perform well for large read/browse datasets. Editing performance should also be acceptable because only visible rows render. The main risk is correctness around virtualized keyboard focus and scroll positioning, which needs Playwright coverage before production adoption.

## Bundle Size

Measured with `npm run build` in this spike:

- `FieldsBedsPage-ZbuAgp-7.js`: `455.37 kB` raw, `137.57 kB` gzip.

Installed package footprint in `node_modules`:

- `@tanstack/react-table`: `796K`
- `@tanstack/table-core`: `3.6M`
- `@tanstack/react-virtual`: `88K`
- `@tanstack/virtual-core`: `460K`

The page chunk remains large because the current MUI DataGrid implementation is still present in the branch for comparison and because the Anbauflächen page pulls shared notes, markdown, MUI, and hierarchy code. A final migration branch would need to remove the unused MUI hierarchy import path before measuring the true net delta.

## Virtualization

TanStack Virtual is a good fit. It is small, explicit, and easy to combine with dynamic row heights by row type. The main integration work is layout: sticky headers, filter rows, total height, scroll container ownership, and test-environment behavior all have to be implemented by OpenFarmPlanner.

## Hierarchy Support

TanStack Table does not give OpenFarmPlanner a complete tree grid out of the box. The spike reuses the existing hierarchy projection and renders a flat indented tree. This is similar to the current solution and the AG Grid Community spike because AG Grid Community does not include Enterprise Tree Data.

This approach is flexible and license-safe, but hierarchy behavior remains application code.

## Inline Editing

Inline editing works for the core editable fields and reuses the existing row update validation and API logic. However, MUI DataGrid still has a more complete editing lifecycle. The TanStack version would need more hardening around:

- Tab behavior between cells
- click-away commit/discard parity
- focus restoration after async saves
- partially valid draft preservation
- screen reader announcements

## Keyboard Operation

The spike supports row-level keyboard behavior:

- Arrow Up/Down moves selection.
- Arrow Left/Right collapses or expands selected parent rows.
- Enter starts editing.
- Delete triggers delete.
- Shift+F10 or ContextMenu opens the context menu.

This is enough for evaluation, but it is not yet feature-parity with the current DataGrid-focused keyboard suite.

## Sorting

Sorting is integrated with the existing persisted sort model and hierarchy index. This keeps sibling ordering consistent with the current implementation. It is intentionally limited to `name` and `area_sqm`, matching current supported behavior.

## Filtering

Per-column text filters are implemented. Active filters operate on the fully expanded row set and keep ancestor rows visible so matching beds do not appear without their Standort/Parzelle context.

This is useful and predictable, but less powerful than DataGrid-style operator filters or AG Grid's column filter menus.

## Styling Effort

Styling effort is high. TanStack is headless, so all of the following are application-owned:

- header layout
- sticky header/filter rows
- column borders
- row hover/selection states
- calculated cell background
- editing controls
- action overlays
- responsive scroll behavior

The upside is design-system control. The downside is more local CSS/SX surface area.

## Integration With Existing Architecture

Integration was feasible because existing hierarchy hooks already isolate much of the domain logic. The spike reused:

- `useHierarchyData`
- `useExpandedState`
- `useHierarchyLevelToggle`
- `useBedOperations`
- `useHierarchyRowUpdate`
- `useHierarchyDelete`
- notes drawer utilities
- persistent sort storage

The strongest fit is at the data/model layer. The weakest fit is at the table interaction layer, where MUI DataGrid-specific focus and edit hooks could not be reused.

## Advantages Over Current Solution

- Smaller, headless table/virtualization dependencies.
- More direct control over DOM structure and styling.
- Less reliance on MUI DataGrid internals and selectors.
- Per-column filtering can be tailored to hierarchy semantics.
- Virtualization is explicit and library-agnostic.

## Disadvantages Versus Current Solution

- More custom code for editing, focus, keyboard navigation, resizing, and accessibility.
- Existing MUI DataGrid tests and utilities cannot be reused directly.
- Feature parity requires significant hardening.
- Current implementation already has mature behavior for row editing, undo, notes, keyboard edge cases, and height management.

## Advantages Over AG Grid Community

- Headless and easier to align precisely with the OpenFarmPlanner design language.
- Smaller dependency footprint than AG Grid.
- No AG Grid-specific theming or module registration.
- No temptation to depend on Enterprise-only Tree Data or context menu features.
- React-first composition model fits the existing component style.

## Disadvantages Versus AG Grid Community

- AG Grid Community provides more built-in grid behavior, including robust column sizing, editing infrastructure, keyboard navigation, and virtualization.
- AG Grid's performance model is more mature for dense data grids.
- TanStack requires more application code to reach comparable grid affordances.

## Validation

Commands run:

- `npm run test -- FieldsBedsTanStackHierarchy.test.tsx FieldsBedsPage.test.tsx`
- `npm run build`
- `FRONTEND_PORT=4178 BACKEND_PORT=8005 npx playwright test e2e/fields-beds-tanstack-spike.spec.ts`

Results:

- 11 focused tests passed.
- Production build passed.
- 2 Playwright spike tests passed, covering small-dataset hierarchy/editing/sorting/filtering/keyboard/context-menu/responsive behavior and a 90-bed virtualized scroll scenario.
- `npm install` reported existing audit findings: 25 vulnerabilities (2 low, 8 moderate, 14 high, 1 critical). These were not introduced through a separate audit remediation in this spike.

## Recommendation From This Spike

TanStack Table + TanStack Virtual is viable for OpenFarmPlanner, but it is not a low-effort replacement for the current Anbauflächen table. It gives the project maximum control and a permissive, lightweight dependency base, but the team must own more grid behavior.

For this specific table, TanStack is the strongest long-term candidate only if OpenFarmPlanner wants a custom, design-system-owned table foundation and is willing to invest in shared table primitives. If the priority is fastest production parity with least custom interaction code, the current MUI DataGrid solution remains safer in the short term.
