import type {
  GridCellParams,
  GridColDef,
  GridRowId,
  GridValidRowModel,
} from '@mui/x-data-grid';
import type { MouseEvent } from 'react';

type Direction = 1 | -1;

interface CellLocation {
  id: GridRowId;
  field: string;
}

interface DataGridNavigationApi<Row extends GridValidRowModel> {
  getAllRowIds?: () => GridRowId[];
  getCellElement?: (id: GridRowId, field: string) => HTMLElement | null;
  getCellParams?: (id: GridRowId, field: string) => GridCellParams<Row>;
  getColumnIndexRelativeToVisibleColumns?: (field: string) => number;
  getRowIndexRelativeToVisibleRows?: (id: GridRowId) => number;
  getVisibleColumns?: () => GridColDef<Row>[];
  isCellEditable?: (params: GridCellParams<Row>) => boolean;
  scrollToIndexes?: (indexes: { rowIndex?: number; colIndex?: number }) => void;
  setCellFocus?: (id: GridRowId, field: string) => void;
}

interface IsCellKeyboardNavigableOptions<Row extends GridValidRowModel> {
  api: DataGridNavigationApi<Row> | null | undefined;
  columns?: readonly GridColDef<Row>[];
  field: string;
  isActionCell?: (params: GridCellParams<Row>) => boolean;
  row?: Row;
  rowId: GridRowId;
}

interface GetKeyboardNavigationTargetOptions<Row extends GridValidRowModel> {
  api: DataGridNavigationApi<Row> | null | undefined;
  columns?: readonly GridColDef<Row>[];
  current: CellLocation;
  direction: Direction;
  isActionCell?: (params: GridCellParams<Row>) => boolean;
  rows?: readonly Row[];
  wrapRows?: boolean;
}

interface FocusKeyboardNavigableCellOptions<Row extends GridValidRowModel> {
  api: DataGridNavigationApi<Row> | null | undefined;
  cell: CellLocation;
  focusEditInput?: boolean;
}

const IGNORED_NAVIGATION_FIELDS = new Set(['actions', 'rowEditActions']);
export const EDIT_CELL_FOCUS_TARGET_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[role="textbox"]:not([aria-disabled="true"])',
  '[role="combobox"]:not([aria-disabled="true"])',
  '.MuiSelect-select[tabindex]:not([tabindex="-1"])',
].join(', ');
const INTERACTIVE_CELL_TARGET_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const getColumns = <Row extends GridValidRowModel>(
  api: DataGridNavigationApi<Row> | null | undefined,
  fallbackColumns: readonly GridColDef<Row>[] = [],
): readonly GridColDef<Row>[] => api?.getVisibleColumns?.() ?? fallbackColumns;

const getRowIds = <Row extends GridValidRowModel>(
  api: DataGridNavigationApi<Row> | null | undefined,
  fallbackRows: readonly Row[] = [],
): readonly GridRowId[] => api?.getAllRowIds?.() ?? fallbackRows.map((row) => row.id as GridRowId);

export function isCellKeyboardNavigable<Row extends GridValidRowModel>({
  api,
  columns = [],
  field,
  isActionCell,
  row,
  rowId,
}: IsCellKeyboardNavigableOptions<Row>): boolean {
  const column = getColumns(api, columns).find((currentColumn) => currentColumn.field === field);
  if (!column || IGNORED_NAVIGATION_FIELDS.has(field)) {
    return false;
  }

  let params: GridCellParams<Row>;
  try {
    params = (api?.getCellParams?.(rowId, field) ?? {
      id: rowId,
      field,
      row,
    }) as GridCellParams<Row>;
  } catch {
    return false;
  }

  if (!params || !params.row) {
    return false;
  }

  if (isActionCell?.(params)) {
    return true;
  }

  if (!column.editable) {
    return false;
  }

  try {
    return api?.isCellEditable?.(params) ?? true;
  } catch {
    return false;
  }
}

export function getKeyboardNavigationTarget<Row extends GridValidRowModel>({
  api,
  columns = [],
  current,
  direction,
  isActionCell,
  rows = [],
  wrapRows = false,
}: GetKeyboardNavigationTargetOptions<Row>): CellLocation | null {
  const visibleColumns = getColumns(api, columns);
  const rowIds = getRowIds(api, rows);
  const currentRowIndex = rowIds.findIndex((rowId) => String(rowId) === String(current.id));
  const currentColumnIndex = visibleColumns.findIndex((column) => column.field === current.field);
  if (currentRowIndex < 0 || currentColumnIndex < 0) {
    return null;
  }

  let rowIndex = currentRowIndex;
  let columnIndex = currentColumnIndex + direction;

  while (rowIndex >= 0 && rowIndex < rowIds.length) {
    while (columnIndex >= 0 && columnIndex < visibleColumns.length) {
      const candidate = {
        id: rowIds[rowIndex],
        field: visibleColumns[columnIndex].field,
      };
      const row = rows.find((currentRow) => String(currentRow.id) === String(candidate.id));
      if (isCellKeyboardNavigable({
        api,
        columns: visibleColumns,
        field: candidate.field,
        isActionCell,
        row,
        rowId: candidate.id,
      })) {
        return candidate;
      }
      columnIndex += direction;
    }

    if (!wrapRows) {
      return null;
    }

    rowIndex += direction;
    columnIndex = direction > 0 ? 0 : visibleColumns.length - 1;
  }

  return null;
}

export function getVerticalKeyboardNavigationTarget<Row extends GridValidRowModel>({
  api,
  columns = [],
  current,
  direction,
  isActionCell,
  rows = [],
}: GetKeyboardNavigationTargetOptions<Row>): CellLocation | null {
  const visibleColumns = getColumns(api, columns);
  const rowIds = getRowIds(api, rows);
  const currentRowIndex = rowIds.findIndex((rowId) => String(rowId) === String(current.id));
  if (currentRowIndex < 0) {
    return null;
  }

  for (let rowIndex = currentRowIndex + direction; rowIndex >= 0 && rowIndex < rowIds.length; rowIndex += direction) {
    const candidate = { id: rowIds[rowIndex], field: current.field };
    const row = rows.find((currentRow) => String(currentRow.id) === String(candidate.id));
    if (isCellKeyboardNavigable({
      api,
      columns: visibleColumns,
      field: candidate.field,
      isActionCell,
      row,
      rowId: candidate.id,
    })) {
      return candidate;
    }

    const sameFieldIndex = visibleColumns.findIndex((column) => column.field === current.field);
    for (let offset = 1; offset < visibleColumns.length; offset += 1) {
      const rightIndex = sameFieldIndex + offset;
      if (rightIndex < visibleColumns.length) {
        const rightCandidate = { id: rowIds[rowIndex], field: visibleColumns[rightIndex].field };
        if (isCellKeyboardNavigable({
          api,
          columns: visibleColumns,
          field: rightCandidate.field,
          isActionCell,
          row,
          rowId: rightCandidate.id,
        })) {
          return rightCandidate;
        }
      }

      const leftIndex = sameFieldIndex - offset;
      if (leftIndex >= 0) {
        const leftCandidate = { id: rowIds[rowIndex], field: visibleColumns[leftIndex].field };
        if (isCellKeyboardNavigable({
          api,
          columns: visibleColumns,
          field: leftCandidate.field,
          isActionCell,
          row,
          rowId: leftCandidate.id,
        })) {
          return leftCandidate;
        }
      }
    }
  }

  return null;
}

export function focusKeyboardNavigableCell<Row extends GridValidRowModel>({
  api,
  cell,
  focusEditInput = false,
}: FocusKeyboardNavigableCellOptions<Row>): void {
  if (!api?.setCellFocus) {
    return;
  }

  const rowIndex = api.getRowIndexRelativeToVisibleRows?.(cell.id);
  const colIndex = api.getColumnIndexRelativeToVisibleColumns?.(cell.field);
  api.scrollToIndexes?.({ rowIndex, colIndex });
  api.setCellFocus(cell.id, cell.field);

  if (!focusEditInput) {
    return;
  }

  const focusEditor = (): boolean => {
    const cellElement = api.getCellElement?.(cell.id, cell.field);
    const editor = cellElement?.querySelector<HTMLElement>(EDIT_CELL_FOCUS_TARGET_SELECTOR);
    if (!editor) {
      return false;
    }

    editor.focus({ preventScroll: true });
    return true;
  };

  focusEditor();
  queueMicrotask(focusEditor);
  window.setTimeout(focusEditor, 0);
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(focusEditor);
  }
}

export function preventReadOnlyCellMouseFocus(event: MouseEvent<HTMLElement>): void {
  event.preventDefault();
  event.stopPropagation();
}

export function isInteractiveCellTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(INTERACTIVE_CELL_TARGET_SELECTOR));
}
