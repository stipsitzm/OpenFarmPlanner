import { useCallback, useLayoutEffect, useRef } from "react";
import { GridRowModes } from "@mui/x-data-grid";
import type { GridRowId, GridRowModesModel, GridRowsProp } from "@mui/x-data-grid";
import type { HierarchyRow } from "../utils/types";

interface HierarchyGridFocusApi {
  getCellElement?: (id: GridRowId, field: string) => HTMLElement | null;
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
  /** Call immediately before setRowModesModel(View) to prevent a browser focus-fixup flash. */
  preFocusEditCell: (rowId: GridRowId) => void;
  queuePostEditFocus: (rowId: GridRowId, preferredField?: string) => void;
  rememberFocusedField: (field: string) => void;
}

const DEFAULT_FOCUS_FIELD = "name";

const hasEditingRow = (rowModesModel: GridRowModesModel): boolean =>
  Object.values(rowModesModel).some((mode) => mode.mode === GridRowModes.Edit);

const getEditingRowId = (
  rowModesModel: GridRowModesModel,
  rows: GridRowsProp<HierarchyRow>,
): GridRowId | null => {
  const editingRowKey = Object.entries(rowModesModel).find(
    ([, mode]) => mode.mode === GridRowModes.Edit,
  )?.[0];
  if (editingRowKey == null) {
    return null;
  }

  return rows.find((row) => String(row.id) === editingRowKey)?.id ?? editingRowKey;
};

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
  const postEditFocusTargetRef = useRef<{ rowId: GridRowId; preferredField?: string } | null>(null);
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

  // Pre-focus the stable cell container div before switching the row back to View mode.
  // When React removes the edit <input> from the DOM, the browser's native focus-fixup
  // would otherwise move focus to the nearest focusable ancestor (often the first row),
  // causing a visible flash. Moving focus to the container first keeps DOM focus anchored
  // through the transition. This does NOT fire MUI's cellFocusOut custom event (which is
  // only emitted by setCellFocus), so it has no unintended edit-stop side-effect.
  const preFocusEditCell = useCallback((rowId: GridRowId): void => {
    gridApiRef.current?.getCellElement?.(rowId, focusedFieldRef.current)?.focus({ preventScroll: true });
  }, [gridApiRef]);

  const queuePostEditFocus = useCallback((rowId: GridRowId, preferredField?: string): void => {
    postEditFocusTargetRef.current = { rowId, preferredField };
  }, []);

  const focusSelectedCell = useCallback((): void => {
    if (selectedRowId != null) {
      focusRow(selectedRowId);
    }
  }, [focusRow, selectedRowId]);

  // useLayoutEffect (not useEffect) fires synchronously before the browser paints,
  // so focus is always corrected within the same commit — no visible flash.
  //
  // On Edit→View transition we focus the row that WAS being edited (from prevModel),
  // not selectedRowId state. Arrow-key navigation only updates selectedRowIdRef (transient);
  // if editing was started via keyboard, selectedRowId state is the last clicked row and
  // would land focus on the wrong row. We also sync selectedRowId so subsequent arrow
  // navigation and focus restoration start from the correct row.
  useLayoutEffect(() => {
    const prevModel = prevRowModesModelRef.current;
    prevRowModesModelRef.current = rowModesModel;

    if (!hasEditingRow(prevModel) || hasEditingRow(rowModesModel)) {
      return;
    }

    const queuedTarget = postEditFocusTargetRef.current;
    postEditFocusTargetRef.current = null;
    const editingRowId = getEditingRowId(prevModel, rows);
    const targetRowId = queuedTarget?.rowId ?? editingRowId;
    if (targetRowId != null) {
      focusRow(targetRowId, queuedTarget?.preferredField);
      setSelectedRowId(targetRowId);
    } else {
      focusSelectedCell();
    }
  }, [focusRow, focusSelectedCell, rowModesModel, rows, setSelectedRowId]);

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
    preFocusEditCell,
    queuePostEditFocus,
    rememberFocusedField,
  };
}
