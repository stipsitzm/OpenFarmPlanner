/**
 * Generic arrow-key navigation state machine for expandable tree/list UIs.
 * Only depends on `id` and `hasChildren`, so it works for any row shape
 * (DataGrid tree rows, Accordion-based grouping, etc.), not just
 * `HierarchyRow`.
 */
export interface KeyboardNavigableRow {
  id: string | number;
  hasChildren?: boolean;
}

export type HierarchyKeyboardAction =
  | { type: "select"; rowId: string | number }
  | { type: "toggle"; rowId: string | number };

const canToggleChildren = (
  row: KeyboardNavigableRow | undefined,
): row is KeyboardNavigableRow => Boolean(row && row.hasChildren === true);

export const getHierarchyKeyboardAction = ({
  expandedRows,
  key,
  rows,
  selectedRowId,
}: {
  expandedRows: Set<string | number>;
  key: string;
  rows: readonly KeyboardNavigableRow[];
  selectedRowId: string | number;
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
