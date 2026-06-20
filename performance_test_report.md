# OpenFarmPlanner Large-Scale Performance Test Report

**Test date:** June 20, 2026
**Frontend:** `http://localhost:5173`
**Backend:** local Django development server with SQLite
**Account:** `martin.stipsitz@gmail.com`
**Project:** `Large Scale Performance Test`

# Executive Summary

The application remains navigable with a large project, but it does not currently present the complete dataset. The most serious issue is silent client-side truncation: API responses report the full object count while most pages consume only the first 100 results. Suppliers are additionally limited to 20 records. Consequently, searches, filters, sorting, hierarchy rendering, dashboard calculations, the graphical view, and the planting calendar operate on incomplete data without warning.

The slowest tested screen was the planting calendar, which took approximately 8.0–11.5 seconds to settle and used approximately 197–220 MB of JavaScript heap in Chromium. Inline hierarchy edits took approximately 2.1–2.3 seconds each because every mutation creates a full-project revision; the generated snapshot was approximately 5.9 MB before JSON/database overhead.

Basic responsive behavior was good: no tested mobile page caused document-level horizontal overflow. Pointer and keyboard context menus worked, and keyboard focus moved between grid cells. However, the mobile planting-plan screen rendered 100 full cards and 406 buttons in a 9,417-pixel document, which will not scale to the requested 5,000 records.

# Test Dataset

The dataset was generated directly through the Django data model using the reusable script:

`backend/scripts/seed_large_scale_performance_test.py`

| Entity | Requested | Created | Visible through default UI/API consumption |
|---|---:|---:|---:|
| Locations | 20 | 20 | 20 |
| Parcels | 300 | 300 | 100 |
| Beds | 2,400 | 2,400 | 100 |
| Cultures | 300 | 300 | 100 |
| Suppliers | 50 | 50 | 20 |
| Planting plans | 5,000 | 5,000 | 100 |

The project includes varied dimensions, dates from 2024 through 2027, crop durations, quantities, suppliers, optional empty fields, short and long text, Markdown, German special characters, symbols such as `€`, `µ`, and `m²`, long entity names, and realistic notes.

## Measured Page Load Times

Times are wall-clock measurements from navigation until network activity settled, in a headless Chromium session against the running development services. Development mode, React Strict Mode, SQLite, and local machine load affect absolute values.

| Screen | Measured time | Approximate JS heap | Notes |
|---|---:|---:|---|
| Initial authenticated culture view | 4.3 s | 48 MB | Only 100 of 300 cultures loaded |
| Dashboard | 1.9–2.3 s | 25–30 MB | Derived from partial data |
| Hierarchy list | 3.2 s | 76 MB | 101 rendered rows; incomplete hierarchy |
| Cultures | 4.3 s | 48 MB | Culture API requests took up to 1.6 s |
| Suppliers | 2.2 s | 37 MB | Only 20 suppliers returned |
| Planting plans | 4.4 s | 75 MB | Only 100 of 5,000 plans loaded |
| Graphical hierarchy | 2.6 s | 84 MB | 20 canvases; incomplete field/bed data |
| Planting calendar | 8.0–11.5 s | 197–220 MB | Slowest and most memory-intensive screen |

# Functional Issues

## F-1: Core pages silently omit most project records

- **Severity:** Critical
- **Reproduction steps:**
  1. Open `Large Scale Performance Test`.
  2. Open Cultures, Planting Plans, or the hierarchy.
  3. Inspect the corresponding API response.
  4. Compare `count` with `results.length`.
- **Expected behavior:** All records are reachable through pagination, infinite loading, server-side filtering, or another explicit large-dataset mechanism.
- **Actual behavior:** Cultures returns `count: 300` with 100 results, planting plans returns `count: 5000` with 100 results, parcels returns `count: 300` with 100 results, and beds returns `count: 2400` with 100 results. The frontend uses only `results` and provides no next-page control or incomplete-data warning.
- **Suggested fix:** Introduce a shared paginated data-loading layer. Use server-side pagination/filtering/sorting for large tables and fetch all required hierarchy pages where a complete relationship graph is necessary.

## F-2: Suppliers beyond the first 20 are inaccessible

- **Severity:** High
- **Reproduction steps:**
  1. Open Suppliers in the test project.
  2. Compare the 20 displayed suppliers with the 50 suppliers in the database.
- **Expected behavior:** All 50 suppliers are reachable.
- **Actual behavior:** The supplier viewset slices list queries to 20 before pagination. The response reports only 20, and the UI has no pagination or “more results” state.
- **Suggested fix:** Remove the unconditional list slice. Add explicit autocomplete endpoints or parameters for limited suggestions, while keeping the main supplier page properly paginated.

## F-3: Hierarchy relationships disappear because child collections are partial

- **Severity:** Critical
- **Reproduction steps:**
  1. Open Anbauflächen in list mode.
  2. Compare the rendered hierarchy with the database counts.
  3. Attempt to reach later locations, parcels, and beds.
- **Expected behavior:** Every location exposes its 15 parcels and every parcel exposes its 8 beds.
- **Actual behavior:** The grid rendered 101 rows from partial field and bed responses. Later locations and parcels were not reachable in the tested hierarchy state even though they exist in the database.
- **Suggested fix:** Load hierarchy data through a dedicated hierarchical endpoint or fetch every page before constructing the tree. Do not build parent/child visibility from independently truncated collections.

## F-4: Search, filtering, and sorting operate on only the loaded subset

- **Severity:** High
- **Reproduction steps:**
  1. Open Cultures.
  2. Search for a culture that sorts beyond the first 100 records, such as a later tomato entry.
  3. Sort planting plans repeatedly.
- **Expected behavior:** Search, filter, and sort cover the entire project dataset.
- **Actual behavior:** Interactions are responsive, but they operate locally on the first page. Records outside the loaded 100 cannot be found or sorted into view.
- **Suggested fix:** Move search/filter/sort to server-side query parameters and display total counts and current result ranges.

## F-5: Dashboard and calendar calculations are based on partial source data

- **Severity:** Critical
- **Reproduction steps:**
  1. Open the dashboard and planting calendar.
  2. Inspect network responses for cultures, parcels, beds, and planting plans.
  3. Compare the displayed information with the 5,000-plan dataset.
- **Expected behavior:** Tasks, occupancy, and summaries reflect the complete active project.
- **Actual behavior:** These screens consume the first 100 planting plans and first 100 related records. The UI gives no indication that its results are incomplete.
- **Suggested fix:** Provide purpose-built aggregate endpoints for dashboard and calendar data. Avoid deriving project-wide results from paginated list endpoints.

## F-6: Graphical view is incomplete and performs per-location layout requests

- **Severity:** High
- **Reproduction steps:**
  1. Open Anbauflächen.
  2. Switch to Grafik.
  3. Inspect the hierarchy responses and layout requests.
- **Expected behavior:** The graphical view represents all 300 parcels and 2,400 beds with bounded request overhead.
- **Actual behavior:** The view receives only 100 parcels and 100 beds and then requests layouts by location. The test observed multiple parallel `/locations/{id}/layouts/` calls, approaching an N+1 request pattern.
- **Suggested fix:** Add a project-level bulk layout endpoint, lazy-load only expanded/visible locations, and ensure the underlying hierarchy data is complete.

# Performance Issues

## P-1: Planting calendar has high load time and memory use

- **Severity:** High
- **Reproduction steps:**
  1. Open Anbaukalender.
  2. Wait for network activity and rendering to settle.
  3. Repeat after navigating through other large pages.
- **Expected behavior:** The calendar becomes interactive within a few seconds and keeps memory bounded.
- **Actual behavior:** The calendar took approximately 8.0–11.5 seconds and used approximately 197–220 MB of JavaScript heap despite displaying only the first 100 plans.
- **Suggested fix:** Profile calendar transformations and rendering, virtualize rows, memoize derived task groups, avoid duplicate data fetches, and return calendar-specific server-side data rather than full generic records.

## P-2: Full-project snapshots make routine edits slow

- **Severity:** High
- **Reproduction steps:**
  1. Open the hierarchy.
  2. Edit a parcel name and press Enter.
  3. Repeat across several rows.
- **Expected behavior:** Inline edits save quickly and remain responsive as project size grows.
- **Actual behavior:** Six measured saves across three parcel records took 2.06–2.27 seconds each. Each mutation creates a complete project snapshot; the initial snapshot was approximately 5.9 MB.
- **Suggested fix:** Replace full snapshots per mutation with compact event/diff revisions, periodic checkpoints, or asynchronous snapshot generation. Add retention and compression policies.

## P-3: Development rendering triggers duplicate list requests

- **Severity:** Medium
- **Reproduction steps:**
  1. Open Cultures, Hierarchy, Planting Plans, or Calendar in the local development frontend.
  2. Observe the network log.
- **Expected behavior:** A page mount performs one request per required resource, or duplicate requests are deduplicated/cancelled without backend work.
- **Actual behavior:** Core list endpoints were commonly requested twice. This is consistent with development Strict Mode effect replay, but it doubles expensive local backend work and obscures realistic profiling.
- **Suggested fix:** Use a request cache/deduplication layer such as TanStack Query, make effects idempotent, and perform production-build benchmarks in addition to development checks.

## P-4: Mobile planting plans render too many controls at once

- **Severity:** High
- **Reproduction steps:**
  1. Set the viewport to 390 × 844.
  2. Open Anbaupläne.
  3. Inspect document height and control count.
- **Expected behavior:** Large mobile lists use incremental rendering and keep the DOM compact.
- **Actual behavior:** The first 100 plans produced a 9,417-pixel document with 406 buttons. Loading all 5,000 records with this representation would be impractical.
- **Suggested fix:** Virtualize or paginate mobile cards, use progressive loading, and keep only visible card actions mounted.

## P-5: Large location card list creates a very long mobile document

- **Severity:** Medium
- **Reproduction steps:**
  1. Set the viewport to 390 × 844.
  2. Open Standorte.
- **Expected behavior:** Twenty locations remain easy to scan and navigate.
- **Actual behavior:** The page reached approximately 6,134 pixels in height, with repeated edit/delete controls and no compact overview mode.
- **Suggested fix:** Add a compact list mode, collapsible details, search, and sticky or contextual actions.

# UX Issues

## U-1: The UI does not disclose incomplete datasets

- **Severity:** Critical
- **Reproduction steps:**
  1. Open any affected large-data page.
  2. Compare displayed rows with API `count`.
- **Expected behavior:** The UI shows totals, pagination state, and whether more records exist.
- **Actual behavior:** Pages appear complete while silently omitting most records.
- **Suggested fix:** Always display total counts and ranges such as “1–100 of 5,000.” Never discard `next`, `previous`, or `count`.

## U-2: Large datasets lack direct navigation and narrowing tools

- **Severity:** High
- **Reproduction steps:**
  1. Open the 300-culture or 5,000-plan dataset.
  2. Attempt to reach a known later record.
- **Expected behavior:** Users can search globally, filter by location/date/culture, save views, and jump to results.
- **Actual behavior:** Existing local interactions cannot reach unloaded records. The hierarchy also lacks an effective way to jump directly to a location or parcel.
- **Suggested fix:** Add server-backed search, facet filters, date ranges, result counts, saved filters, and hierarchy “expand/collapse all” plus direct location navigation.

## U-3: Long mobile lists create excessive repetitive interaction

- **Severity:** Medium
- **Reproduction steps:**
  1. Open planting plans on a mobile viewport.
  2. Scroll through the first 100 cards.
- **Expected behavior:** Users can scan, filter, and act without traversing thousands of controls.
- **Actual behavior:** Every loaded record mounts multiple controls, producing a very long, repetitive page.
- **Suggested fix:** Use virtualized cards, compact summaries, sticky filters, and actions revealed only for the active card.

## U-4: Version history becomes expensive as project size grows

- **Severity:** Medium
- **Reproduction steps:**
  1. Press `Alt+V`.
  2. Measure time until the history dialog appears.
- **Expected behavior:** History opens promptly and scales with revision count.
- **Actual behavior:** The dialog took approximately 3.4 seconds to appear with only one final retained revision. Routine edits had already demonstrated expensive snapshot creation.
- **Suggested fix:** Return lightweight revision metadata for the list and fetch snapshot details only on demand.

# Accessibility Issues

## A-1: Culture search input has no reliable programmatic accessible name

- **Severity:** High
- **Reproduction steps:**
  1. Open Cultures.
  2. Inspect the search input with an accessibility tree or role-based query.
- **Expected behavior:** The textbox is discoverable as “Kultur suchen.”
- **Actual behavior:** The input had neither `aria-label` nor `aria-labelledby`, and a role query by the visible label did not find it reliably.
- **Suggested fix:** Associate the visible label using `label`/`htmlFor` and a stable input `id`, or provide an explicit localized `aria-label`.

## A-2: Notes cells expose duplicate controls with the same accessible name

- **Severity:** Medium
- **Reproduction steps:**
  1. Open the hierarchy.
  2. Inspect a notes cell with “Notiz bearbeiten.”
- **Expected behavior:** One interactive element appears in the accessibility tree.
- **Actual behavior:** Both an outer `div role="button"` and an inner `button` exposed the same accessible name. Role-based selection returned two controls for one visual action.
- **Suggested fix:** Keep only the native button interactive. Remove the outer button role/tab stop and attach click behavior to the native control.

## A-3: Culture mobile view contains unnamed buttons

- **Severity:** Medium
- **Reproduction steps:**
  1. Set the viewport to 390 × 844.
  2. Open Cultures.
  3. Inspect buttons without text, `aria-label`, or title.
- **Expected behavior:** Every icon button has a localized accessible name.
- **Actual behavior:** Two unnamed buttons were detected in the rendered mobile culture view.
- **Suggested fix:** Add localized `aria-label` values and verify with automated accessibility tests at desktop and mobile breakpoints.

## A-4: Keyboard context menus work, but focus density is high

- **Severity:** Low
- **Reproduction steps:**
  1. Focus the first hierarchy grid cell.
  2. Press an arrow key, then `Shift+F10`.
- **Expected behavior:** Focus moves predictably and the context menu opens for the focused row.
- **Actual behavior:** This behavior worked. However, large rendered mobile lists create hundreds of focusable actions, making sequential keyboard navigation impractical.
- **Suggested fix:** Preserve the working grid pattern, but reduce mounted actions through virtualization and roving tabindex patterns on mobile cards.

# Console Errors

## C-1: MUI Data Grid reports a zero-width parent

- **Severity:** Medium
- **Reproduction steps:**
  1. Navigate to hierarchy or planting plans in a fresh page.
  2. Observe the browser console.
- **Expected behavior:** Data Grid mounts only when its container has a measurable width.
- **Actual behavior:** The console reported: `MUI X: useResizeContainer - The parent DOM element of the Data Grid has an empty width` and stated that the grid displayed at `0px`.
- **Suggested fix:** Avoid mounting the grid inside a hidden/zero-width container, or defer grid rendering until layout is measurable.

## C-2: Aborted requests occur during rapid page switching

- **Severity:** Low
- **Reproduction steps:**
  1. Switch rapidly among hierarchy, cultures, planting plans, and calendar.
  2. Observe failed requests.
- **Expected behavior:** Obsolete requests are intentionally cancelled without noisy application errors.
- **Actual behavior:** Multiple Vite module and API requests ended with `net::ERR_ABORTED`. Most were navigation cancellations rather than server failures.
- **Suggested fix:** Treat cancellation as expected, avoid logging it as an application error, and use abort signals consistently.

# Recommendations

1. Implement shared server-side pagination, filtering, sorting, and search for all large collections.
2. Add dedicated aggregate endpoints for dashboard, calendar, and seed-demand views.
3. Add a dedicated complete hierarchy endpoint or recursively paginated hierarchy loader.
4. Remove the supplier list hard limit and separate autocomplete behavior from management-page behavior.
5. Virtualize desktop grids where needed and mobile card collections in particular.
6. Replace mutation-time full-project snapshots with diffs/events plus periodic checkpoints.
7. Batch graphical layout loading and lazy-load only expanded or visible locations.
8. Add request caching/deduplication and profile a production frontend build.
9. Display totals, loaded ranges, loading progress, and incomplete/error states explicitly.
10. Add automated accessibility coverage for accessible names, nested interactive controls, keyboard menus, and mobile breakpoints.
11. Add repeatable large-dataset performance tests using the included seed script.

# Priority Ranking

| Priority | Issue | Severity | Rationale |
|---:|---|---|---|
| 1 | F-1 / U-1: Silent collection truncation | Critical | Users cannot see most project data and are not warned |
| 2 | F-5: Dashboard/calendar use partial data | Critical | Project-wide decisions can be based on incorrect summaries |
| 3 | F-3: Incomplete hierarchy | Critical | Core location/parcel/bed relationships become inaccessible |
| 4 | F-4: Search/filter/sort only loaded subset | High | Users cannot reliably locate or organize records |
| 5 | P-1: Calendar time and memory | High | Current partial dataset already approaches unacceptable cost |
| 6 | P-2: Full snapshots on every edit | High | Write latency and storage grow directly with project size |
| 7 | F-2: Supplier hard limit | High | Thirty of fifty suppliers are inaccessible |
| 8 | P-4: Mobile planting-plan DOM size | High | The mobile representation cannot scale toward 5,000 plans |
| 9 | F-6: Graphical view request pattern | High | Incomplete data plus per-location calls increase cost |
| 10 | A-1: Unnamed culture search | High | A primary navigation control is unreliable for assistive technology |
| 11 | C-1: Zero-width Data Grid mount | Medium | Indicates fragile rendering and produces console errors |
| 12 | A-2 / A-3: Duplicate or unnamed controls | Medium | Adds ambiguity for keyboard and screen-reader users |
| 13 | P-3: Duplicate development requests | Medium | Distorts profiling and doubles backend work in development |
| 14 | U-4: Slow version history | Medium | Revision UX will worsen as snapshots accumulate |
