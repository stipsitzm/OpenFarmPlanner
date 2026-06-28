import { useState, useRef, useCallback, useEffect } from 'react';
import type { GridRowId } from '@mui/x-data-grid';
import { focusContextMenuOrigin, useContextMenuFocus } from '../contextMenuFocus';
import {
  shouldOpenCustomContextMenu,
  suppressNativeContextMenu,
  useCloseCustomContextMenuOnNativeContextMenu,
} from '../../../utils/contextMenu';

const ROW_ACTION_LONG_PRESS_MS = 550;

export interface RowActionMenuState {
  rowId: GridRowId;
  anchorEl?: HTMLElement;
  mouseX?: number;
  mouseY?: number;
}

export interface UseDataGridRowActionMenuParams {
  rowsById: Map<string, unknown>;
  hasContextualRowActions: boolean;
  markContextMenuHintUsed: () => void;
  setSelectedRowIds: React.Dispatch<React.SetStateAction<GridRowId[]>>;
  getRowIdFromElement: (target: EventTarget | null) => GridRowId | null;
}

export function useDataGridRowActionMenu({
  rowsById,
  hasContextualRowActions,
  markContextMenuHintUsed,
  setSelectedRowIds,
  getRowIdFromElement,
}: UseDataGridRowActionMenuParams) {
  const [rowActionMenuState, setRowActionMenuState] = useState<RowActionMenuState | null>(null);
  const [longPressFeedbackRowId, setLongPressFeedbackRowId] = useState<GridRowId | null>(null);
  const rowActionMenuOriginRef = useRef<HTMLElement | null>(null);
  const rowActionLongPressTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearRowActionLongPressTimer = useCallback((): void => {
    if (rowActionLongPressTimerRef.current === null) {
      return;
    }
    window.clearTimeout(rowActionLongPressTimerRef.current);
    rowActionLongPressTimerRef.current = null;
  }, []);

  useEffect(() => () => {
    clearRowActionLongPressTimer();
  }, [clearRowActionLongPressTimer]);

  const openRowActionMenuAt = useCallback((
    rowId: GridRowId,
    originElement: HTMLElement | null,
    mouseX: number,
    mouseY: number,
  ): void => {
    markContextMenuHintUsed();
    setSelectedRowIds([rowId]);
    rowActionMenuOriginRef.current = originElement;
    setRowActionMenuState({ rowId, mouseX, mouseY });
  }, [markContextMenuHintUsed, setSelectedRowIds]);

  const openRowActionContextMenu = useCallback((rowId: GridRowId, event: React.MouseEvent): void => {
    suppressNativeContextMenu(event);
    openRowActionMenuAt(rowId, event.currentTarget as HTMLElement, event.clientX + 2, event.clientY - 6);
  }, [openRowActionMenuAt]);

  const openRowActionKeyboardContextMenu = useCallback((rowId: GridRowId, originElement: HTMLElement): void => {
    const rowElement = originElement.closest<HTMLElement>('[role="row"][data-id]') ?? originElement;
    const rect = rowElement.getBoundingClientRect();
    openRowActionMenuAt(rowId, rowElement, rect.left + Math.min(240, rect.width), rect.top + 12);
  }, [openRowActionMenuAt]);

  const closeRowActionMenu = useCallback((): void => {
    setRowActionMenuState(null);
    setLongPressFeedbackRowId(null);
    focusContextMenuOrigin(rowActionMenuOriginRef.current);
  }, []);

  const isRowActionContextMenuTarget = useCallback((target: EventTarget | null): boolean => {
    if (!hasContextualRowActions || !shouldOpenCustomContextMenu(target)) {
      return false;
    }
    const rowId = getRowIdFromElement(target);
    return rowId !== null && rowsById.has(String(rowId));
  }, [getRowIdFromElement, hasContextualRowActions, rowsById]);

  const repositionOpenRowActionMenu = useCallback((event: globalThis.MouseEvent): void => {
    setRowActionMenuState((currentState) => (
      currentState
        ? { rowId: currentState.rowId, mouseX: event.clientX + 2, mouseY: event.clientY - 6 }
        : currentState
    ));
  }, []);

  useCloseCustomContextMenuOnNativeContextMenu(
    Boolean(rowActionMenuState),
    closeRowActionMenu,
    isRowActionContextMenuTarget,
    repositionOpenRowActionMenu,
  );

  const rowActionMenuListRef = useContextMenuFocus(Boolean(rowActionMenuState), closeRowActionMenu);

  // Used by the parent's clearRowInteractionState when a row is removed.
  const clearRowActionMenuForId = useCallback((rowId: GridRowId): void => {
    const rowKey = String(rowId);
    setLongPressFeedbackRowId((current) => (String(current) === rowKey ? null : current));
    setRowActionMenuState((current) => (current && String(current.rowId) === rowKey ? null : current));
  }, []);

  const handleGridTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>): void => {
    if (!hasContextualRowActions || event.touches.length !== 1) {
      return;
    }
    if (!shouldOpenCustomContextMenu(event.target)) {
      return;
    }
    const rowId = getRowIdFromElement(event.target);
    if (rowId === null || !rowsById.has(String(rowId))) {
      return;
    }
    const originElement = event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>('[role="row"][data-id]')
      : null;
    const touch = event.touches[0];
    clearRowActionLongPressTimer();
    rowActionLongPressTimerRef.current = window.setTimeout(() => {
      markContextMenuHintUsed();
      setSelectedRowIds([rowId]);
      setLongPressFeedbackRowId(rowId);
      rowActionMenuOriginRef.current = originElement;
      setRowActionMenuState({ rowId, mouseX: touch.clientX + 2, mouseY: touch.clientY - 6 });
      rowActionLongPressTimerRef.current = null;
    }, ROW_ACTION_LONG_PRESS_MS);
  }, [clearRowActionLongPressTimer, getRowIdFromElement, hasContextualRowActions, markContextMenuHintUsed, rowsById, setSelectedRowIds]);

  const handleGridTouchMove = useCallback((): void => {
    clearRowActionLongPressTimer();
  }, [clearRowActionLongPressTimer]);

  const handleGridTouchEnd = useCallback((): void => {
    clearRowActionLongPressTimer();
  }, [clearRowActionLongPressTimer]);

  return {
    rowActionMenuState,
    longPressFeedbackRowId,
    rowActionMenuOriginRef,
    rowActionMenuListRef,
    openRowActionMenuAt,
    openRowActionContextMenu,
    openRowActionKeyboardContextMenu,
    closeRowActionMenu,
    isRowActionContextMenuTarget,
    clearRowActionMenuForId,
    handleGridTouchStart,
    handleGridTouchMove,
    handleGridTouchEnd,
  };
}
