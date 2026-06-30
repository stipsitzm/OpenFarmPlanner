import { useCallback, useRef, useState } from "react";
import type { HierarchyRow } from "../utils/types";
import {
  focusContextMenuOrigin,
  useContextMenuFocus,
} from "../../data-grid/contextMenuFocus";
import {
  shouldOpenCustomContextMenu,
  suppressNativeContextMenu,
  useCloseCustomContextMenuOnNativeContextMenu,
} from "../../../utils/contextMenu";

interface ContextMenuState {
  row: HierarchyRow;
  mouseX: number;
  mouseY: number;
}

interface UseHierarchyContextMenuParams {
  rows: HierarchyRow[];
  markContextMenuHintUsed: () => void;
  setSelectedRowId: (id: string | number) => void;
  setTreeActive: (active: boolean) => void;
}

export function useHierarchyContextMenu({
  rows,
  markContextMenuHintUsed,
  setSelectedRowId,
  setTreeActive,
}: UseHierarchyContextMenuParams) {
  const [contextMenuState, setContextMenuState] =
    useState<ContextMenuState | null>(null);
  const contextMenuOriginRef = useRef<HTMLElement | null>(null);
  const touchLongPressTimeoutRef = useRef<number | null>(null);

  const openContextMenuForRow = useCallback(
    (
      row: HierarchyRow,
      mouseX: number,
      mouseY: number,
      origin?: HTMLElement | null,
      options?: { markHintUsed?: boolean },
    ): void => {
      if (options?.markHintUsed !== false) {
        markContextMenuHintUsed();
      }
      setSelectedRowId(row.id as string | number);
      setTreeActive(true);
      contextMenuOriginRef.current = origin ?? null;
      setContextMenuState({ row, mouseX, mouseY });
    },
    [markContextMenuHintUsed, setSelectedRowId, setTreeActive],
  );

  const handleNameCellContextMenu = useCallback(
    (
      event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      row: HierarchyRow,
    ): void => {
      if (!shouldOpenCustomContextMenu(event.target)) return;
      suppressNativeContextMenu(event);
      const hasPointerCoordinates =
        "clientX" in event &&
        "clientY" in event &&
        typeof event.clientX === "number" &&
        typeof event.clientY === "number" &&
        Number.isFinite(event.clientX) &&
        Number.isFinite(event.clientY) &&
        (event.clientX !== 0 || event.clientY !== 0);
      if (hasPointerCoordinates) {
        openContextMenuForRow(row, event.clientX + 2, event.clientY - 6, event.currentTarget);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      openContextMenuForRow(row, rect.right - 8, rect.top + 12, event.currentTarget);
    },
    [openContextMenuForRow],
  );

  const isHierarchyContextMenuTarget = useCallback(
    (target: EventTarget | null): boolean => {
      if (!shouldOpenCustomContextMenu(target) || !(target instanceof HTMLElement)) {
        return false;
      }
      const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
      const rowId = rowElement?.dataset.id;
      return Boolean(rowId && rows.some((row) => String(row.id) === rowId));
    },
    [rows],
  );

  const handleGridContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>): void => {
      if (!isHierarchyContextMenuTarget(event.target)) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
      const rowId = rowElement?.dataset.id;
      if (!rowId) return;
      const targetRow = rows.find((row) => String(row.id) === rowId);
      if (!targetRow) return;
      suppressNativeContextMenu(event);
      setSelectedRowId(targetRow.id as string | number);
      setTreeActive(true);
      openContextMenuForRow(targetRow, event.clientX + 2, event.clientY - 6, rowElement);
    },
    [isHierarchyContextMenuTarget, openContextMenuForRow, rows, setSelectedRowId, setTreeActive],
  );

  const handleGridTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>): void => {
      if (!shouldOpenCustomContextMenu(event.target)) return;
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
      const rowId = rowElement?.dataset.id;
      if (!rowId) return;
      const targetRow = rows.find((row) => String(row.id) === rowId);
      const touch = event.touches[0];
      if (!targetRow || !touch) return;
      touchLongPressTimeoutRef.current = window.setTimeout(() => {
        openContextMenuForRow(targetRow, touch.clientX, touch.clientY, rowElement, {
          markHintUsed: false,
        });
      }, 550);
    },
    [openContextMenuForRow, rows],
  );

  const handleGridTouchEnd = useCallback((): void => {
    if (touchLongPressTimeoutRef.current !== null) {
      window.clearTimeout(touchLongPressTimeoutRef.current);
      touchLongPressTimeoutRef.current = null;
    }
  }, []);

  const closeContextMenu = useCallback((): void => {
    setContextMenuState(null);
    focusContextMenuOrigin(contextMenuOriginRef.current);
  }, []);

  const repositionOpenContextMenu = useCallback(
    (event: globalThis.MouseEvent): void => {
      setContextMenuState((currentState) =>
        currentState
          ? { row: currentState.row, mouseX: event.clientX + 2, mouseY: event.clientY - 6 }
          : currentState,
      );
    },
    [],
  );

  useCloseCustomContextMenuOnNativeContextMenu(
    contextMenuState !== null,
    closeContextMenu,
    isHierarchyContextMenuTarget,
    repositionOpenContextMenu,
  );

  const contextMenuListRef = useContextMenuFocus(
    contextMenuState !== null,
    closeContextMenu,
  );

  return {
    contextMenuState,
    openContextMenuForRow,
    handleNameCellContextMenu,
    isHierarchyContextMenuTarget,
    handleGridContextMenu,
    handleGridTouchStart,
    handleGridTouchEnd,
    closeContextMenu,
    contextMenuListRef,
  };
}
