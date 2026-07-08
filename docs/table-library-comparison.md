# Table Library Comparison

## Compared Options

This document compares three approaches for the Anbauflächen hierarchy table:

- Current solution: MUI DataGrid with OpenFarmPlanner hierarchy projection and custom hooks.
- AG Grid Community spike: experimental AG Grid Community prototype in the sibling worktree `OpenFarmPlanner-ag-grid-spike`.
- TanStack Table + TanStack Virtual spike: experimental prototype in this branch.

The comparison focuses on long-term suitability for OpenFarmPlanner, not on immediate migration.

## Summary Table

| Criterion | Current MUI DataGrid | AG Grid Community | TanStack Table + Virtual |
| --- | --- | --- | --- |
| Development effort | Already implemented, but complex | Medium-high; many grid features built in | High; headless composition requires custom behavior |
| Maintainability | Good short-term, selector/API coupling remains | Good for grid-native behavior, but AG-specific | Good if shared primitives are extracted; heavy if page-local |
| Performance | Good after existing scalability work | Strong built-in row virtualization | Strong explicit virtualization |
| User experience | Most complete today | Promising, grid-like, dense | Promising, custom, not fully hardened |
| Keyboard operation | Most mature today | Strong baseline from grid engine | Functional prototype, needs hardening |
| Hierarchical data | Custom projection | Custom projection; Tree Data is Enterprise-only | Custom projection |
| Inline editing | Mature row edit lifecycle | Built-in editing, wired to existing save path | Manual row editing; more work required |
| Sorting | Existing persisted sibling sort | Built-in UI plus existing sort integration | Existing persisted sibling sort |
| Filtering | Limited in current hierarchy table | Stronger built-in column filters | Simple per-column text filters |
| Responsive behavior | Mature, known behavior | Good in spike, needs more review | Good in spike, custom layout |
| Bundle size | Already paid dependency cost | Adds AG Grid packages | Adds small TanStack packages |
| Extensibility | Moderate; constrained by DataGrid model | High for grid features, lower for custom design | High for custom features |
| Long-term fit | Safe incremental choice | Good if AG Grid UX is accepted | Best if OpenFarmPlanner wants owned table primitives |

## Development Effort

Current solution: lowest immediate effort because it is already implemented. Further work is mostly incremental fixes.

AG Grid Community: medium-high. The spike is about `1,415` lines and uses AG Grid's editing, virtualization, theming, and column features, but still needs OpenFarmPlanner-specific hierarchy projection and custom context menu handling.

TanStack Table + Virtual: high. The spike is `1,627` lines because the library is headless and OpenFarmPlanner must implement rendering, edit controls, filters, keyboard behavior, resizing, sticky headers, and layout.

## Maintainability

Current solution: maintainable in the short term because it is covered by existing tests and user behavior is known. The downside is accumulated custom DataGrid focus logic and styling selectors.

AG Grid Community: maintainable for standard grid features. Long-term maintainability depends on accepting AG Grid conventions and avoiding Enterprise-only APIs.

TanStack Table + Virtual: maintainable only if the work becomes shared infrastructure. As a page-local implementation, it duplicates table behavior that other pages would also need.

## Performance

Current solution: already optimized for large hierarchies with conditional expansion and DataGrid virtualization.

AG Grid Community: strong performance profile. The AG spike includes a Playwright scenario with 120 beds and asserts that rendered rows stay below 80.

TanStack Table + Virtual: strong performance potential. The TanStack spike uses explicit row virtualization and tests large initial hierarchy behavior. Further Playwright scrolling coverage is still needed.

## User Experience

Current solution: best current UX because it has the most complete edge-case handling: undo, notes, click-away behavior, keyboard focus, deep links, empty states, and responsive behavior.

AG Grid Community: good dense-grid UX. It may feel more like an enterprise grid and require styling work to fully match OpenFarmPlanner.

TanStack Table + Virtual: best design-control potential, but the prototype is not yet as polished in editing and keyboard details.

## Keyboard Operation

Current solution: strongest today. There are existing tests for Enter behavior, focus after save, context menus, and keyboard navigation.

AG Grid Community: strong baseline from AG Grid, with custom handling for hierarchy expand/collapse and row actions.

TanStack Table + Virtual: implements row-level keyboard support, but cell-level parity and async focus restoration need more work.

## Hierarchical Data

Current solution: custom flat hierarchy projection.

AG Grid Community: also custom flat hierarchy projection because AG Grid Tree Data is not available in Community.

TanStack Table + Virtual: custom flat hierarchy projection, which fits the headless model but leaves all tree behavior in application code.

## Inline Editing

Current solution: most complete and already integrated with existing validation and draft handling.

AG Grid Community: built-in cell editing is a useful base and was wired to existing save logic in the spike.

TanStack Table + Virtual: works for name, length, and width, but editing lifecycle is manual and needs more production hardening.

## Sorting

Current solution: uses the existing persisted sort model and sorts siblings in the projected hierarchy.

AG Grid Community: can use AG Grid sort UI, but the spike still needs careful coordination with hierarchy projection to avoid flattening semantics incorrectly.

TanStack Table + Virtual: uses the existing persisted sort model for hierarchy-safe sibling sorting.

## Filtering

Current solution: the hierarchy table has limited filtering.

AG Grid Community: strongest built-in filtering features among the three, though custom hierarchy semantics still need care.

TanStack Table + Virtual: simple per-column text filters are implemented. The spike keeps ancestors visible for matches, which is a good hierarchy-specific behavior.

## Responsive Behavior

Current solution: already tuned for the app's breakpoints.

AG Grid Community: spike includes a mobile-width Playwright check that the center viewport fits without unnecessary horizontal overflow.

TanStack Table + Virtual: custom responsive behavior works in build/tests, with compact notes and dynamic height. It still needs real-device and Playwright scrolling coverage.

## Bundle Size

Current solution: no new dependency if retained. MUI DataGrid is already part of the project.

AG Grid Community: adds `ag-grid-community` and `ag-grid-react` `^36.0.0`. This is likely the largest new dependency option.

TanStack Table + Virtual: adds `@tanstack/react-table` and `@tanstack/react-virtual`. Installed package footprint is smaller than AG Grid, but the current spike branch still includes the original MUI implementation, so the measured page chunk is not the final net migration cost.

Measured TanStack spike build:

- `FieldsBedsPage-ZbuAgp-7.js`: `455.37 kB` raw, `137.57 kB` gzip.

## Extensibility

Current solution: good for features that map to MUI DataGrid; less ideal for custom hierarchy-specific interaction.

AG Grid Community: strong for conventional grid features such as column menus, editing, sizing, and virtualization. We must avoid features reserved for Enterprise.

TanStack Table + Virtual: strongest for custom interaction and design-system ownership, but only after extracting shared primitives.

## Long-Term Suitability For OpenFarmPlanner

Current solution is best for stability and immediate product continuity.

AG Grid Community is a good candidate if OpenFarmPlanner wants a mature grid engine and accepts AG Grid's conventions. Its main drawback is that the most attractive hierarchy feature, Tree Data, is Enterprise-only.

TanStack Table + Virtual is the best candidate if OpenFarmPlanner wants a lightweight, open, custom table foundation. It aligns with a design-system-first direction, but it requires deliberate investment in reusable table infrastructure and accessibility tests.

## Recommendation

Do not migrate immediately.

For the short term, keep the current MUI DataGrid implementation because it is the most functionally complete and has the lowest regression risk.

For the long term, prefer TanStack Table + TanStack Virtual over AG Grid Community if OpenFarmPlanner is willing to build and maintain shared table primitives. The TanStack approach keeps the project fully in control of hierarchy semantics, styling, and future feature design while using small permissive OSS libraries. It is the better strategic fit for OpenFarmPlanner's custom agricultural workflows.

AG Grid Community should remain a fallback candidate if the team decides that mature built-in grid behavior is more important than custom design ownership. Its Community license is acceptable, but the absence of Community Tree Data reduces its advantage for this specific hierarchy table.
