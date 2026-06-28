import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { GridRowId, GridRowsProp } from "@mui/x-data-grid";
import type { HierarchyRow } from "../utils/types";

interface UseHierarchyNavigationStateParams {
  expandedRows: Set<GridRowId>;
  rows: GridRowsProp<HierarchyRow>;
}

interface UseHierarchyNavigationStateResult {
  activateRow: (rowId: GridRowId) => void;
  expandedRowsRef: MutableRefObject<Set<GridRowId>>;
  rowsRef: MutableRefObject<GridRowsProp<HierarchyRow>>;
  selectRow: (rowId: GridRowId) => void;
  selectedRowId: GridRowId | null;
  selectedRowIdRef: MutableRefObject<GridRowId | null>;
  setSelectedRowId: Dispatch<SetStateAction<GridRowId | null>>;
  setTreeActive: Dispatch<SetStateAction<boolean>>;
  treeActive: boolean;
  treeActiveRef: MutableRefObject<boolean>;
}

export function useHierarchyNavigationState({
  expandedRows,
  rows,
}: UseHierarchyNavigationStateParams): UseHierarchyNavigationStateResult {
  const [selectedRowId, setSelectedRowId] = useState<GridRowId | null>(null);
  const [treeActive, setTreeActive] = useState(false);
  const selectedRowIdRef = useRef<GridRowId | null>(selectedRowId);
  const treeActiveRef = useRef(treeActive);
  const rowsRef = useRef(rows);
  const expandedRowsRef = useRef(expandedRows);

  useLayoutEffect(() => {
    selectedRowIdRef.current = selectedRowId;
  }, [selectedRowId]);

  useLayoutEffect(() => {
    treeActiveRef.current = treeActive;
  }, [treeActive]);

  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useLayoutEffect(() => {
    expandedRowsRef.current = expandedRows;
  }, [expandedRows]);

  const selectRow = useCallback((rowId: GridRowId): void => {
    setSelectedRowId(rowId);
  }, []);

  const activateRow = useCallback((rowId: GridRowId): void => {
    setSelectedRowId(rowId);
    setTreeActive(true);
  }, []);

  return {
    activateRow,
    expandedRowsRef,
    rowsRef,
    selectRow,
    selectedRowId,
    selectedRowIdRef,
    setSelectedRowId,
    setTreeActive,
    treeActive,
    treeActiveRef,
  };
}
