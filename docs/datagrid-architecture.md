# DataGrid Architecture

OpenFarmPlanner builds most editable tables on `EditableDataGrid`
(`frontend/src/components/data-grid/DataGrid.tsx`), a wrapper around MUI X
`<DataGrid>`. This doc covers what OpenFarmPlanner *added* on top of the
stock grid. It intentionally does not repeat:

- keyboard focus regions and the global shortcut system —
  [keyboard-architecture.md](./keyboard-architecture.md)
- autosave-on-blur mechanics — `AUTOSAVE_IMPLEMENTATION.md`
- the Standort/Parzelle/Beet tree view (a *different*, raw `<DataGrid>`
  page, not `EditableDataGrid`) — [occupancy-tree-hierarchy.md](./occupancy-tree-hierarchy.md)

**Not every table uses `EditableDataGrid`.** `FieldsBedsHierarchy.tsx`
renders a raw MUI `<DataGrid>` with its own, independently-implemented
context menu and keyboard navigation (`useHierarchyContextMenu.ts`). It
duplicates rather than reuses the patterns below — when you change one,
check whether the other needs the same fix, but don't assume the code is
shared.

## File map

```text
frontend/src/components/data-grid/
  DataGrid.tsx            EditableDataGrid<T> — the main wrapper component
  index.ts                Public barrel export
  hooks/
    useDataGridCommandApi.ts     builds the imperative EditableDataGridCommandApi
    useDataGridRowCommands.ts    addRow/editSelectedRow/openRowById/focusTable
    useDataGridDelete.ts         delete + optional undo-snackbar flow
    useDataGridRowActionMenu.ts  right-click / long-press / keyboard row menu
  keyboardEditing.ts       "just start typing" / F2 spreadsheet-edit-start behavior
  keyboardNavigation.ts    Tab/Arrow cell navigation rules, grid-API-agnostic
  contextMenuFocus.ts      Arrow/Home/End/Enter/Esc navigation *inside* an open menu
  AreaM2EditCell.tsx, DateEditCell.tsx, PlantsCountEditCell.tsx,
  SearchableSelectEditCell.tsx                            custom edit cells
  GermanDateEditCell.tsx   shared German date parse/format helpers only
                           (its edit-cell component was removed as dead code)
  NotesCell.tsx, NotesDrawer.tsx, NotesPreviewPopover.tsx,
  useNotesEditor.ts, useNotesPreview.ts, markdown.ts,
  noteAttachmentsCache.ts               rich markdown notes + photo attachments
  tableClipboard.ts, TableCopyMenuItems.tsx   copy row/table as TSV
  columns.tsx, calculatedColumns.tsx    column builders (select, computed)
  dataGridUtils.tsx, handlers.ts, styles.ts, localeText.ts   shared helpers
```

## Imperative API (`EditableDataGridCommandApi`)

A page passes a `commandApiRef` into `EditableDataGrid`; the grid populates
it on mount (`hooks/useDataGridCommandApi.ts`):

```ts
interface EditableDataGridCommandApi {
  addRow, editSelectedRow, deleteSelectedRow, deleteRow(rowId),
  getSelectedRowId, setDraftValues(rowId, values), commitDraftValues(rowId, values),
  reload, focusTable, openRowById(rowId, { startEdit? }),
}
```

`openRowById(rowId, { startEdit })` is the deep-link entry point: it scrolls
to and selects a row, optionally opening edit mode. Today only
`PlantingPlans.tsx` uses it — the Gantt calendar's context menu
("Anbauplan öffnen" / "bearbeiten") navigates to
`/app/planting-plans?planId=<id>&edit=true`, and `PlantingPlans.tsx` resolves
that param to `openRowById(planId, { startEdit: true })`. This deliberately
replaced an earlier `initialRow`-based approach, which always prefilled a
**new draft row** — clicking "open" on an existing task used to silently
create a duplicate-looking blank plan instead of opening the one clicked.
If you add deep-linking into another grid page, this is the reference
pattern to follow, not a one-off to reinvent.

`setDraftValues`/`commitDraftValues` let external code push field values
into a row that's already mid-edit (e.g. a calculated side-effect from
another field), either staying in edit mode or committing immediately.

## Custom edit cells

MUI's stock edit cells didn't fit a few OpenFarmPlanner-specific needs:

- **`AreaM2EditCell` / `PlantsCountEditCell`** — both preserve the raw text
  the user is typing (including a mid-typed decimal separator or a
  temporarily invalid/partial value) instead of coercing on every
  keystroke like MUI's built-in number editor does; normalization happens
  at save time, not on each keypress.
- **`DateEditCell`** (the default for any `type: 'date'` column, applied
  automatically by `dataGridUtils.tsx`'s `applyDefaultDateEditCell`) — a
  from-scratch segmented `TT.MM.JJJJ` editor: per-segment cursor tracking,
  Up/Down arrows increment/decrement the active day/month/year segment
  (with correct month-length/rollover handling), Left/Right move between
  segments, plus a hidden native `<input type="date">` behind a calendar
  icon as a picker fallback.
- **`GermanDateEditCell.tsx`** no longer exports an edit-cell component —
  the component itself was confirmed unused as a `renderEditCell` anywhere
  and removed. The file now only holds the shared
  `parseGermanDateText`/`formatDateAsGerman` helpers that `DateEditCell`
  imports.
- **`SearchableSelectEditCell`** wraps an MUI Autocomplete for single-select
  columns with large option lists (cultures, suppliers) that a plain
  `singleSelect` dropdown wouldn't make browsable; `columns.tsx` also
  exposes a `createSingleSelectColumn` builder (plain dropdown) for
  short option lists — pick whichever builder matches the option-list size,
  don't default to the searchable one everywhere.

## Keyboard editing/navigation inside the grid

`docs/keyboard-architecture.md` still lists "applying the region-shortcut
pattern to DataGrid" as future work for the *page-level* keyboard model —
that's still true. But cell-level Tab/Arrow/Enter/F2 navigation
(`keyboardEditing.ts` + `keyboardNavigation.ts`) is fully implemented:

- **`keyboardNavigation.ts`** — pure helpers (grid-API-agnostic, easy to
  unit test) for stepping Tab/Shift+Tab/Left/Right across visible, editable
  columns, and Up/Down across rows — falling back to the nearest navigable
  cell in the target row if the same column isn't editable there (so Enter
  after editing one column doesn't get stuck on a read-only next-row cell).
- **`keyboardEditing.ts`**'s `useSpreadsheetEditStarter` implements
  Excel-like "just start typing" (a printable keydown on a non-editing
  cell immediately opens edit mode and *replaces* the cell's value with the
  typed character, buffering rapid keystrokes typed before the edit-cell
  component has actually mounted) and F2 (opens edit mode *without*
  altering the value — the standard spreadsheet distinction between the
  two).
- Notes cells (see below) are deliberately excluded from both spreadsheet
  auto-edit-start and the F2 flow — Enter/Space on a notes cell opens the
  notes drawer instead.

## Hover actions / row actions / context menu

Triggers: right-click, the `ContextMenu` keyboard key / `Shift+F10`, and a
550ms touch long-press (with a `.ofp-row-long-press` visual affordance
during the hold). All three funnel into the same
`hooks/useDataGridRowActionMenu.ts` state machine, positioned either at the
mouse coordinates or the focused cell's bounding rect. Menu contents:
caller-supplied row actions (duplicate/delete by default) plus
"copy row"/"copy table" (see below). Closing the menu restores keyboard
focus to whatever opened it.

A first-run **discovery hint** (`ContextMenuHint.tsx` /
`useContextMenuHint.ts`) shows a small "right-click a row" banner once,
only on fine-pointer desktop viewports, persisted per-user in
`localStorage` and synced across tabs — this is UX polish, not
functionality; don't remove the dismissal persistence when touching it.

Separately, `renderInlineActionCell` overlays icon buttons directly inside
one cell on row hover — this is the "hover actions" surface distinct from
the right-click menu.

**`FieldsBedsHierarchy.tsx`'s `useHierarchyContextMenu.ts` is a second,
hand-rolled implementation of the same right-click/long-press pattern**,
built directly on the same lower-level shared primitives
(`contextMenuFocus.ts`, `utils/contextMenu.ts`) but not on
`useDataGridRowActionMenu.ts` itself, because that page uses a raw
`<DataGrid>`, not `EditableDataGrid`. Treat a UX fix to one as *not*
automatically fixing the other.

## Notes / markdown cells

Any column listed in `EditableDataGrid`'s `notes` prop renders through
`NotesCell.tsx` instead of a normal edit cell: an icon, a plain-text
excerpt, and (unless `compactIndicator`) a hover/focus/touch-triggered
preview popover (`NotesPreviewPopover.tsx` — one shared popover instance
per grid, not one per row, opened after a 250ms hover delay). Notes are
*not* edited inline — clicking opens `NotesDrawer.tsx`, a full markdown
editor (Edit/Preview tabs, a formatting toolbar) that additionally supports
photo attachments when the column has an `attachmentNoteIdField`: capture
or pick a photo, crop it with a hand-rolled pointer-drag crop tool, and
downscale/re-encode to WebP (falling back to JPEG) client-side before
upload. `noteAttachmentsCache.ts` caches attachment fetches per note id so
re-hovering a row doesn't refetch; the drawer explicitly invalidates that
cache after upload/delete.

`markdown.ts`'s `stripCitationMarkers` strips AI-citation markers of the
form `【digits†identifier】` from note text. **Unclear/needs check**: trace
where such markers actually get inserted (an LLM-assisted import/enrichment
path elsewhere in the app, presumably) before documenting the "why" further
— it wasn't found in the files reviewed for this doc.

## Copy/paste

Copy-only today (no paste-in). `tableClipboard.ts` formats selected rows as
tab/newline-delimited text (dates localized `de-DE`, arrays joined with
`, `); `TableCopyMenuItems.tsx` adds "Copy row" (header + the right-clicked
row) and "Copy table" (header + every currently loaded/filtered/sorted row)
to the row-action menu — both paste directly into Excel/Sheets.

## Column visibility

Column show/hide is handled entirely by **MUI's native columns panel**
today. A custom show/hide menu and a separate ResizeObserver-driven
"autofit" responsive-hiding feature both existed earlier and were
deliberately removed in favor of it (see the git history around
`Replace custom column show/hide menu with MUI's native columns panel` and
`Fold responsive column hiding into the native visibility model`) — do not
reintroduce a bespoke visibility UI. `EditableDataGrid` only passes
`columnVisibilityModel`/`onColumnVisibilityModelChange` straight through to
the underlying MUI grid; the actual state lives in the page via
`useColumnVisibility(...)` (`frontend/src/hooks/useColumnVisibility.ts`),
which persists to `localStorage` under `tableColumns.<tableKey>` and
supports a `defaultHiddenFieldsOnSmallScreen` list that only applies until
the user makes their *first* explicit visibility choice — after that, the
user's choice always wins regardless of screen size.

`FieldsBedsHierarchy.tsx` (raw `<DataGrid>`) has **no column-visibility
feature at all** today — this was an explicit scope cut when the feature
was migrated to the native panel elsewhere, not an oversight to "fix" as a
drive-by change.

## Row history / versioning — not a grid feature

Culture version history (backed by the generic `EntityRevision` model, see
[versioning-and-history.md](./versioning-and-history.md)) is shown in a
**standalone MUI `Dialog`** on `Cultures.tsx`, populated via
`cultureAPI.history(...)`. It does not surface inside any grid cell,
row-action menu, or notes drawer — if you're asked to "show history in the
grid," that's new work, not exposing something that already half-exists.

## Cross-cutting utilities

- `dataGridUtils.tsx` — `isUnsavedDraftRow` (heuristic for local-only,
  not-yet-saved rows), `SaveBlockedError` (lets `onBeforeSaveRow` silently
  keep a row in edit mode without surfacing an error), `prepareDataGridColumn`
  (applies the default date edit cell and makes unsaved draft rows immune
  to active column filters), `getSortedRowIds`/`orderRowsByStableIds`
  (rows are kept in a stable client-side order rather than trusting the
  grid's own post-edit row order).
- `handlers.ts` — `handleRowEditStop` deliberately suppresses MUI's default
  Escape-triggers-save-attempt behavior so Escape reliably means "cancel";
  see `AUTOSAVE_IMPLEMENTATION.md` for how the blur-triggered save itself
  works.
- `styles.ts` — the single `dataGridSx` object defining every `ofp-*` CSS
  class referenced above (`.ofp-row-editing`, `.ofp-cell-dirty`,
  `.ofp-cell-error`, `.ofp-row-long-press`, ...).

## What to check before changing this layer

- If you change row-action-menu or keyboard-navigation behavior, check
  whether `FieldsBedsHierarchy.tsx`'s parallel implementation needs the
  same change (see above) — it will not pick up the fix automatically.
- Keep new edit cells consistent with the "preserve raw input text, defer
  normalization to save time" pattern used by the existing custom edit
  cells, rather than coercing on every keystroke.
- Don't reintroduce a custom column-visibility UI; extend
  `useColumnVisibility`/the native panel instead.
- Notes columns must stay `editable: false` and excluded from the
  spreadsheet auto-edit-start/F2 flow — they have their own editor.
