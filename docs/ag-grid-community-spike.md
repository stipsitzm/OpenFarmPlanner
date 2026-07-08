# AG Grid Community Spike: Anbauflächen

## Summary

This branch is an experimental spike, not a production migration. It replaces only the Anbauflächen list table with an AG Grid Community prototype in `frontend/src/pages/FieldsBedsHierarchyAgGridSpike.tsx`; the existing MUI implementation remains in `FieldsBedsHierarchy.tsx` for comparison.

Recommendation: do not migrate now. AG Grid Community is technically usable for the table basics, but the two most important differentiators for this page, native tree data and the built-in context menu, are Enterprise-only. A production migration would still keep substantial OpenFarmPlanner-specific hierarchy, keyboard, focus, notes, and context-menu code.

## Current implementation

The current Anbauflächen table is implemented in `frontend/src/pages/FieldsBedsHierarchy.tsx` with MUI X Data Grid (`@mui/x-data-grid`) plus OpenFarmPlanner-specific hierarchy utilities and hooks.

Relevant current pieces:

- Hierarchy: `buildHierarchyIndex`, `createHierarchyRowsProjector`, and `useExpandedState` flatten Standort -> Parzelle -> Beet into rows.
- Expand/collapse: custom row state and `HierarchyLevelButtons`.
- Inline editing: MUI row edit mode with `useHierarchyRowUpdate`.
- Keyboard/focus: custom hooks `useHierarchyGridKeyboard`, `useHierarchyGridFocus`, `useHierarchyKeyboard`.
- Context menu: custom MUI menu via `useHierarchyContextMenu`.
- Notes/tooltips: shared `NotesCell`, `NotesDrawer`, missing-dimension tooltips.
- Layout/performance: MUI Data Grid virtualization on desktop, measured dynamic height to the lower viewport area, mobile `autoHeight`.

## Prototype implementation

The spike adds:

- `ag-grid-community` and `ag-grid-react` version `36.0.0`, both MIT-licensed according to npm metadata.
- `FieldsBedsHierarchyAgGridSpike.tsx`, used only by `FieldsBedsPage.tsx`.
- `frontend/e2e/fields-beds-ag-grid-spike.spec.ts` for focused browser smoke coverage.

The prototype imports only Community packages. It does not import `ag-grid-enterprise`, `AllEnterpriseModule`, `TreeDataModule`, `ContextMenuModule`, `RowGroupingModule`, `SetFilterModule`, `MasterDetailModule`, `SideBarModule`, or `ExcelExportModule`.

## Feature findings

Works reasonably well:

- Vertical virtualization works for expanded large data; the spike e2e confirms only a small visible row window is rendered for 120 beds.
- Basic keyboard navigation, F2 editing, Enter commit, and ArrowLeft/ArrowRight expand/collapse are feasible.
- Inline editing can reuse the existing API/save validation path through AG Grid `readOnlyEdit`.
- Column resize, text/number filtering, and basic app-owned sorting are straightforward.
- Page-level mobile containment can be kept without making the whole page wider.

Works worse or needs custom rebuilding:

- Native tree hierarchy is not available in Community. AG Grid Tree Data is marked Enterprise in the official docs: https://www.ag-grid.com/javascript-data-grid/tree-data/
- Built-in AG Grid context menus are Enterprise-only: https://www.ag-grid.com/javascript-data-grid/context-menu/
- Column menus are Enterprise-only; Community can show filters but not the full column menu: https://www.ag-grid.com/javascript-data-grid/column-menu/
- Hierarchy-aware filtering is not solved by Community. Built-in filters operate on rendered flat rows, so parent/child reveal semantics would need custom logic.
- The prototype currently has internal AG Grid horizontal overflow on mobile. The page itself stays contained, but this still needs UX refinement before production.
- Deep focus behavior is less polished than the MUI implementation. The existing MUI version has substantial custom logic for post-save focus and deep-link focus restoration.
- Programmatic bottom scrolling in the large-data smoke was not reliable enough to assert; virtualization works, but scroll-to-row behavior would need more investigation.

## Enterprise-only gaps

Using AG Grid Community means these requirements cannot be solved with AG Grid native features:

- Tree Data for Standort -> Parzelle -> Beet.
- Built-in right-click context menu and custom AG Grid menu items.
- Full column menu.
- Row grouping / grouping panel.
- Set Filter, advanced filters, master/detail, server-side row model, Excel export, integrated charts.

The prototype deliberately does not use those APIs.

## License, bundle, styling, maintenance

- License: Community packages are MIT; this is compatible for evaluation.
- Bundle size: production build reports `FieldsBedsPage` at about `1,506 kB` minified / `430 kB` gzip. This is a major concern. The spike uses `AllCommunityModule`; a production attempt should try a tighter module list, but some useful APIs currently route through AG Grid modules that are less ergonomic than MUI's existing setup.
- Styling: AG Grid Material theme is close enough for a prototype but does not match OpenFarmPlanner's table details out of the box. Hover actions, note cells, missing-dimension highlighting, and header controls all need custom CSS/React renderers.
- Maintenance: replacing MUI does not remove much complexity. It moves complexity into AG Grid renderers plus a compatibility layer around existing hierarchy hooks.

## Comparison to MUI / current solution

MUI advantages:

- Already integrated across the app.
- Existing tests cover complex focus, edit, and keyboard behavior.
- Existing UI styling and notes/context-menu patterns are already consistent.
- No new major dependency or route chunk increase.

AG Grid Community advantages:

- Strong base grid performance and virtualization.
- Good built-in cell navigation and editors for simple flat tables.
- Filters and resizable columns are quick to enable.

AG Grid Community disadvantages for this page:

- Core hierarchy feature is Enterprise-only.
- Built-in context menu is Enterprise-only.
- Recreating existing keyboard/focus behavior is non-trivial.
- Bundle impact is high in the naive implementation.

## Validation

Passed:

- `npm run build`
- `npm run test -- FieldsBedsPage`
- `npx eslint src/pages/FieldsBedsHierarchyAgGridSpike.tsx`
- `npx playwright test e2e/fields-beds-ag-grid-spike.spec.ts --project=chromium`

Additional observations:

- A full `npm run lint` still fails on pre-existing repository-wide React Compiler lint findings unrelated to this spike.
- Existing `FieldsBedsHierarchy.scalability` and `FieldsBedsHierarchy.navigation` tests still pass against the old MUI component, but they do not validate the new AG Grid spike because they import `FieldsBedsHierarchy.tsx` directly.

## Final recommendation

Reject a direct replacement for now. AG Grid Community is a good grid, but for this specific Anbauflächen page the Community edition does not remove the hardest parts. A later migration could be reconsidered if:

- the team accepts rebuilding hierarchy/filter/focus behavior as app-owned code,
- bundle size can be reduced with a tighter module setup,
- mobile horizontal overflow is solved,
- and a production-grade AG Grid test suite replaces the MUI-specific focus/edit tests.

AG Grid Enterprise would make the technical fit stronger, mainly because of Tree Data and context menus, but that changes the license and cost discussion and was intentionally out of scope for this spike.
