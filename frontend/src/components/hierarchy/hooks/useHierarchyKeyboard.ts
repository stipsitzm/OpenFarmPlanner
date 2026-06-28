import { useEffect } from "react";
import type { GridRowId } from "@mui/x-data-grid";
import type { HierarchyRow } from "../utils/types";
import { isTypingInEditableElement } from "../../../hooks/useKeyboardShortcuts";

interface UseHierarchyKeyboardParams {
  contextMenuState: { row: HierarchyRow } | null;
  treeActive: boolean;
  tableWrapperRef: React.RefObject<HTMLDivElement | null>;
  rowsRef: React.MutableRefObject<HierarchyRow[]>;
  selectedRowIdRef: React.MutableRefObject<string | number | null>;
  expandedRowsRef: React.MutableRefObject<Set<string | number>>;
  setSelectedRowId: (id: string | number) => void;
  setTreeActive: (active: boolean) => void;
  toggleExpand: (id: GridRowId) => void;
  discardActiveRowEdit: () => void;
  openContextMenuForRow: (
    row: HierarchyRow,
    mouseX: number,
    mouseY: number,
    origin?: HTMLElement | null,
  ) => void;
}

export function useHierarchyKeyboard({
  contextMenuState,
  treeActive,
  tableWrapperRef,
  rowsRef,
  selectedRowIdRef,
  expandedRowsRef,
  setSelectedRowId,
  setTreeActive,
  toggleExpand,
  discardActiveRowEdit,
  openContextMenuForRow,
}: UseHierarchyKeyboardParams): void {
  // Window-level keyboard handlers: Alt+T focus, ArrowDown/Up navigation,
  // ArrowLeft/Right expand/collapse. A separate listener handles context-menu
  // keyboard shortcuts so its dependency array stays minimal.
  useEffect(() => {
    const handleDocumentPointerDown = (event: MouseEvent) => {
      if (!tableWrapperRef.current?.contains(event.target as Node)) {
        discardActiveRowEdit();
        setTreeActive(false);
      }
    };

    const handleFocusTable = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== "t" && event.key !== "T") return;
      if (isTypingInEditableElement(document.activeElement)) return;

      const firstRow = rowsRef.current[0];
      if (!firstRow) return;

      event.preventDefault();
      const targetId = selectedRowIdRef.current ?? firstRow.id;
      setSelectedRowId(targetId);
      setTreeActive(true);

      const selectedElement = document.querySelector(`[data-id="${String(targetId)}"]`);
      if (selectedElement instanceof HTMLElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    };

    const handleTreeNavigation = (event: KeyboardEvent) => {
      const currentSelectedRowId = selectedRowIdRef.current;
      if (contextMenuState !== null || !treeActive || !currentSelectedRowId) return;
      if (isTypingInEditableElement(document.activeElement)) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const currentRows = rowsRef.current;
      const currentIndex = currentRows.findIndex((row) => row.id === currentSelectedRowId);
      if (currentIndex === -1) return;

      let performedAction = false;
      let targetRowId: string | number | null = currentSelectedRowId;

      if (event.key === "ArrowDown") {
        const nextRow = currentRows[currentIndex + 1];
        if (nextRow) {
          targetRowId = nextRow.id;
          setSelectedRowId(nextRow.id);
          performedAction = true;
        }
      } else if (event.key === "ArrowUp") {
        const previousRow = currentRows[currentIndex - 1];
        if (previousRow) {
          targetRowId = previousRow.id;
          setSelectedRowId(previousRow.id);
          performedAction = true;
        }
      } else if (event.key === "ArrowRight") {
        const row = currentRows[currentIndex];
        if (
          row &&
          (row.type === "location" || row.type === "field") &&
          row.hasChildren === true &&
          !expandedRowsRef.current.has(row.id)
        ) {
          toggleExpand(row.id);
          performedAction = true;
        }
      } else if (event.key === "ArrowLeft") {
        const row = currentRows[currentIndex];
        if (row && expandedRowsRef.current.has(row.id)) {
          toggleExpand(row.id);
          performedAction = true;
        }
      }

      if (!performedAction) return;
      event.preventDefault();

      const selectedElement = document.querySelector(
        `[data-id="${String(targetRowId ?? currentSelectedRowId)}"]`,
      );
      if (selectedElement instanceof HTMLElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    };

    document.addEventListener("mousedown", handleDocumentPointerDown);
    window.addEventListener("keydown", handleFocusTable);
    window.addEventListener("keydown", handleTreeNavigation);

    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      window.removeEventListener("keydown", handleFocusTable);
      window.removeEventListener("keydown", handleTreeNavigation);
    };
  }, [contextMenuState, discardActiveRowEdit, expandedRowsRef, rowsRef, selectedRowIdRef, setSelectedRowId, setTreeActive, tableWrapperRef, toggleExpand, treeActive]);

  // Context-menu keyboard trigger (ContextMenu key / Shift+F10).
  useEffect(() => {
    const handleContextMenuKeyboard = (event: KeyboardEvent) => {
      const shouldOpen =
        event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
      const currentSelectedRowId = selectedRowIdRef.current;
      if (
        !shouldOpen ||
        !treeActive ||
        !currentSelectedRowId ||
        isTypingInEditableElement(document.activeElement)
      ) {
        return;
      }

      const selectedRow = rowsRef.current.find((row) => row.id === currentSelectedRowId);
      if (!selectedRow) return;

      event.preventDefault();
      event.stopPropagation();
      const targetElement = document.querySelector(
        `[data-id="${String(currentSelectedRowId)}"]`,
      ) as HTMLElement | null;
      if (!targetElement) return;
      const rect = targetElement.getBoundingClientRect();
      openContextMenuForRow(
        selectedRow,
        rect.left + Math.min(240, rect.width),
        rect.top + 12,
        targetElement,
      );
    };

    window.addEventListener("keydown", handleContextMenuKeyboard);
    return () => window.removeEventListener("keydown", handleContextMenuKeyboard);
  }, [openContextMenuForRow, rowsRef, selectedRowIdRef, treeActive]);
}
