import type { GridRowId } from "@mui/x-data-grid";
import type { HierarchyRow } from "./types";

export type HierarchyKeyboardAction =
  | { type: "select"; rowId: GridRowId }
  | { type: "toggle"; rowId: GridRowId };

const canToggleChildren = (row: HierarchyRow | undefined): row is HierarchyRow =>
  Boolean(
    row &&
      (row.type === "location" || row.type === "field") &&
      row.hasChildren === true,
  );

export const getHierarchyKeyboardAction = ({
  expandedRows,
  key,
  rows,
  selectedRowId,
}: {
  expandedRows: Set<GridRowId>;
  key: string;
  rows: readonly HierarchyRow[];
  selectedRowId: GridRowId;
}): HierarchyKeyboardAction | null => {
  const currentIndex = rows.findIndex((row) => row.id === selectedRowId);
  if (currentIndex === -1) {
    return null;
  }

  if (key === "ArrowDown") {
    const nextRow = rows[currentIndex + 1];
    return nextRow ? { type: "select", rowId: nextRow.id } : null;
  }

  if (key === "ArrowUp") {
    const previousRow = rows[currentIndex - 1];
    return previousRow ? { type: "select", rowId: previousRow.id } : null;
  }

  const currentRow = rows[currentIndex];
  if (key === "ArrowRight") {
    return canToggleChildren(currentRow) && !expandedRows.has(currentRow.id)
      ? { type: "toggle", rowId: currentRow.id }
      : null;
  }

  if (key === "ArrowLeft") {
    return currentRow && expandedRows.has(currentRow.id)
      ? { type: "toggle", rowId: currentRow.id }
      : null;
  }

  return null;
};
