import { useCallback, useLayoutEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { GridRowModes } from "@mui/x-data-grid";
import type { GridRowId, GridRowModesModel, GridRowsProp } from "@mui/x-data-grid";
import type { HierarchyRow } from "../utils/types";

interface HierarchyGridFocusApi {
  setCellFocus?: (id: GridRowId, field: string) => void;
}

interface UseHierarchyGridFocusParams {
  getFocusableField?: (rowId: GridRowId, preferredField: string) => string | null;
  gridApiRef: {
    current?: HierarchyGridFocusApi | null;
  };
  rowModesModel: GridRowModesModel;
  rows: GridRowsProp<HierarchyRow>;
  selectedRowId: string | number | null;
  setSelectedRowId: (rowId: string | number) => void;
  treeActive: boolean;
}

interface UseHierarchyGridFocusResult {
  focusRow: (rowId: GridRowId, preferredField?: string) => void;
  focusedFieldRef: MutableRefObject<string>;
  rememberFocusedField: (field: string) => void;
}

const DEFAULT_FOCUS_FIELD = "name";

const hasEditingRow = (rowModesModel: GridRowModesModel): boolean =>
  Object.values(rowModesModel).some((mode) => mode.mode === GridRowModes.Edit);

const getEditingRowId = (rowModesModel: GridRowModesModel): string | null =>
  Object.entries(rowModesModel).find(([, mode]) => mode.mode === GridRowModes.Edit)?.[0] ?? null;

const findFallbackVisibleRow = (
  previousRows: GridRowsProp<HierarchyRow>,
  visibleRows: GridRowsProp<HierarchyRow>,
  hiddenRowId: string | number,
): HierarchyRow | undefined => {
  const visibleRowIds = new Set(visibleRows.map((row) => String(row.id)));
  const previousIndex = previousRows.findIndex((row) => row.id === hiddenRowId);

  if (previousIndex > -1) {
    for (let index = previousIndex - 1; index >= 0; index -= 1) {
      const candidate = previousRows[index] as HierarchyRow;
      if (visibleRowIds.has(String(candidate.id))) {
        return candidate;
      }
    }
  }

  return visibleRows[0] as HierarchyRow | undefined;
};

export function useHierarchyGridFocus({
  getFocusableField,
  gridApiRef,
  rowModesModel,
  rows,
  selectedRowId,
  setSelectedRowId,
  treeActive,
}: UseHierarchyGridFocusParams): UseHierarchyGridFocusResult {
  const focusedFieldRef = useRef(DEFAULT_FOCUS_FIELD);
  const prevRowModesModelRef = useRef<GridRowModesModel>({});
  const prevRowsRef = useRef(rows);

  const rememberFocusedField = useCallback((field: string): void => {
    focusedFieldRef.current = field || DEFAULT_FOCUS_FIELD;
  }, []);

  const focusRow = useCallback((rowId: GridRowId, preferredField?: string): void => {
    const api = gridApiRef.current;
    const focusField = getFocusableField?.(rowId, preferredField ?? focusedFieldRef.current) ?? DEFAULT_FOCUS_FIELD;
    focusedFieldRef.current = focusField;
    api?.setCellFocus?.(rowId, focusField);
  }, [getFocusableField, gridApiRef]);

  const focusSelectedCell = useCallback((): void => {
    if (selectedRowId != null) {
      focusRow(selectedRowId);
    }
  }, [focusRow, selectedRowId]);

  // useLayoutEffect (not useEffect) so focus is restored synchronously during the
  // commit phase, before the browser paints.
  //
  // When a row exits edit mode, we focus the row that WAS being edited (identified
  // from prevModel), NOT selectedRowId state. This is critical because arrow-key
  // navigation only updates selectedRowIdRef (transient), not the selectedRowId
  // React state. If the user navigated to a row via arrow keys and pressed Enter to
  // edit it, selectedRowId state is stale (the last clicked row). Focusing it would
  // visually jump to the wrong row. Using prevModel's editing row ID guarantees we
  // focus the row the user actually just saved, regardless of how they started the edit.
  //
  // We also call setSelectedRowId to sync state, so subsequent arrow navigation and
  // focus restoration start from the correct row.
  useLayoutEffect(() => {
    const prevModel = prevRowModesModelRef.current;
    prevRowModesModelRef.current = rowModesModel;

    if (!hasEditingRow(prevModel) || hasEditingRow(rowModesModel)) {
      return;
    }

    const editingRowId = getEditingRowId(prevModel);
    if (editingRowId != null) {
      focusRow(editingRowId);
      setSelectedRowId(editingRowId);
    } else {
      focusSelectedCell();
    }
  }, [focusRow, focusSelectedCell, rowModesModel, setSelectedRowId]);

  useLayoutEffect(() => {
    if (treeActive) {
      focusSelectedCell();
    }
  }, [focusSelectedCell, selectedRowId, treeActive]);

  useLayoutEffect(() => {
    const previousRows = prevRowsRef.current;
    prevRowsRef.current = rows;

    if (!selectedRowId || !treeActive) {
      return;
    }
    if (rows.some((row) => row.id === selectedRowId)) {
      return;
    }

    const fallbackRow = findFallbackVisibleRow(previousRows, rows, selectedRowId);
    if (fallbackRow) {
      setSelectedRowId(fallbackRow.id);
    }
  }, [rows, selectedRowId, setSelectedRowId, treeActive]);

  return {
    focusRow,
    focusedFieldRef,
    rememberFocusedField,
  };
}
