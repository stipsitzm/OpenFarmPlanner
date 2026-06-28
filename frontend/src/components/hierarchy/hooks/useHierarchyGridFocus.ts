import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { GridRowModes } from "@mui/x-data-grid";
import type { GridRowId, GridRowModesModel, GridRowsProp } from "@mui/x-data-grid";
import type { HierarchyRow } from "../utils/types";

interface HierarchyGridFocusApi {
  setCellFocus?: (id: GridRowId, field: string) => void;
  selectRow?: (id: GridRowId, isSelected?: boolean, resetOtherRows?: boolean) => void;
}

interface UseHierarchyGridFocusParams {
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
  rememberFocusedField: (field: string) => void;
  selectRow: (rowId: GridRowId) => void;
}

const DEFAULT_FOCUS_FIELD = "name";

const hasEditingRow = (rowModesModel: GridRowModesModel): boolean =>
  Object.values(rowModesModel).some((mode) => mode.mode === GridRowModes.Edit);

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

  const selectRow = useCallback((rowId: GridRowId): void => {
    setSelectedRowId(rowId);
  }, [setSelectedRowId]);

  const focusSelectedCell = useCallback((): void => {
    if (selectedRowId == null) {
      return;
    }

    gridApiRef.current?.setCellFocus?.(selectedRowId, focusedFieldRef.current);
  }, [gridApiRef, selectedRowId]);

  useEffect(() => {
    const prevModel = prevRowModesModelRef.current;
    prevRowModesModelRef.current = rowModesModel;

    if (hasEditingRow(prevModel) && !hasEditingRow(rowModesModel)) {
      focusSelectedCell();
    }
  }, [focusSelectedCell, rowModesModel]);

  useLayoutEffect(() => {
    if (treeActive) {
      focusSelectedCell();
    }

    if (selectedRowId != null) {
      gridApiRef.current?.selectRow?.(selectedRowId, true, true);
    }
  }, [focusSelectedCell, gridApiRef, selectedRowId, treeActive]);

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
    rememberFocusedField,
    selectRow,
  };
}
