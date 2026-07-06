import { useCallback } from 'react';
import { GridRowModes } from '@mui/x-data-grid';
import type { GridApiCommunity } from '@mui/x-data-grid';
import type { GridColDef, GridRowId, GridRowModesModel } from '@mui/x-data-grid';
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { EditableRow } from '../types';

interface ScrollFocusGridApi {
  getVisibleColumns: () => { field: string }[];
  getRowIndexRelativeToVisibleRows: (id: GridRowId) => number;
  getColumnIndexRelativeToVisibleColumns: (field: string) => number;
  scrollToIndexes: (params: { rowIndex?: number; colIndex?: number }) => void;
  setCellFocus: (id: GridRowId, field: string) => void;
}

// Scrolls a row into view and, unless `focus: false`, moves keyboard focus
// onto its first non-action column — deferred to the next animation frame
// since the row may not exist in the grid's virtualized viewport until
// after the current render pass (e.g. right after an expand/select state
// change). Shared by focusTable and openRowById below.
function scrollAndFocusRow(api: ScrollFocusGridApi, rowId: GridRowId, options: { focus?: boolean } = {}): void {
  const firstField = api.getVisibleColumns()
    .find((col) => col.field !== 'actions' && col.field !== 'rowEditActions')?.field;
  requestAnimationFrame(() => {
    api.scrollToIndexes(firstField
      ? {
          rowIndex: api.getRowIndexRelativeToVisibleRows(rowId),
          colIndex: api.getColumnIndexRelativeToVisibleColumns(firstField),
        }
      : { rowIndex: api.getRowIndexRelativeToVisibleRows(rowId) });
    if (options.focus !== false && firstField) {
      api.setCellFocus(rowId, firstField);
    }
  });
}

interface UseDataGridRowCommandsParams<T extends EditableRow> {
  gridApiRef: RefObject<GridApiCommunity | null>;
  rowsById: Map<string, T>;
  columns: GridColDef[];
  selectedRowIds: GridRowId[];
  setSelectedRowIds: Dispatch<SetStateAction<GridRowId[]>>;
  setRowModesModel: Dispatch<SetStateAction<GridRowModesModel>>;
  rowSnapshotRef: MutableRefObject<Map<string, T>>;
}

export function useDataGridRowCommands<T extends EditableRow>({
  gridApiRef,
  rowsById,
  columns,
  selectedRowIds,
  setSelectedRowIds,
  setRowModesModel,
  rowSnapshotRef,
}: UseDataGridRowCommandsParams<T>) {
  const handleEditSelectedRow = useCallback((): void => {
    const selectedRowId = selectedRowIds[0];
    if (!selectedRowId) {
      return;
    }

    setRowModesModel((oldModel) => ({
      ...oldModel,
      [selectedRowId]: { mode: GridRowModes.Edit, fieldToFocus: columns[0]?.field },
    }));
  }, [columns, selectedRowIds, setRowModesModel]);

  const handleStartRowEdit = useCallback((rowId: GridRowId, field?: string): void => {
    const rowKey = String(rowId);
    if (!rowSnapshotRef.current.has(rowKey)) {
      const row = rowsById.get(rowKey);
      if (row) {
        rowSnapshotRef.current.set(rowKey, row);
      }
    }

    const fieldToFocus = field ?? columns.find((column) => column.editable !== false)?.field ?? columns[0]?.field;
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [rowId]: { mode: GridRowModes.Edit, fieldToFocus },
    }));
  }, [columns, rowSnapshotRef, rowsById, setRowModesModel]);

  const focusTable = useCallback((): void => {
    const api = gridApiRef.current;
    if (!api) return;
    const targetId = selectedRowIds[0] ?? api.getAllRowIds()[0];
    if (targetId == null) return;
    scrollAndFocusRow(api, targetId);
  }, [gridApiRef, selectedRowIds]);

  // Scrolls to and selects a specific row by id, optionally opening edit
  // mode on it — used by pages that deep-link into this grid (e.g.
  // "Anbauplan öffnen"/"bearbeiten" from the Gantt calendar's context menu)
  // instead of just prefilling a brand-new draft row via `initialRow`.
  const openRowById = useCallback((rowId: GridRowId, options?: { startEdit?: boolean }): void => {
    const api = gridApiRef.current;
    if (!api || !rowsById.has(String(rowId))) return;
    const shouldStartEdit = options?.startEdit !== false;
    setSelectedRowIds([rowId]);
    // Edit mode moves focus into its own input via handleStartRowEdit's
    // `fieldToFocus` below; only move keyboard focus here for the
    // view-only (non-edit) case.
    scrollAndFocusRow(api, rowId, { focus: !shouldStartEdit });
    if (shouldStartEdit) {
      handleStartRowEdit(rowId);
    }
  }, [gridApiRef, handleStartRowEdit, rowsById, setSelectedRowIds]);

  return {
    handleEditSelectedRow,
    handleStartRowEdit,
    focusTable,
    openRowById,
  };
}
