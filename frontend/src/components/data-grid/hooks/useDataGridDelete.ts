import { useState, useRef, useCallback, useEffect } from 'react';
import type { GridRowId, GridRowModesModel, GridRowsProp } from '@mui/x-data-grid';
import { extractApiErrorMessage } from '../../../api/errors';
import { confirmAction } from '../../../utils/confirmAction';
import { DELETE_UNDO_DURATION_MS } from '../DeleteUndoSnackbar';
import { isUnsavedDraftRow } from '../dataGridUtils';
import type { TFunction } from 'i18next';
import type { DataGridAPI, DeleteUndoOptions, EditableRow } from '../types';

interface PendingDeleteWithUndo<T extends EditableRow> {
  id: string;
  rowId: GridRowId;
  row: T;
  rowsBeforeDelete: T[];
  stableRowOrderBeforeDelete: GridRowId[];
  rowModeBeforeDelete?: GridRowModesModel[string];
  visible: boolean;
}

interface UseDataGridDeleteParams<T extends EditableRow> {
  rowsById: Map<string, T>;
  rows: GridRowsProp<T>;
  stableRowOrder: GridRowId[];
  rowModesModel: GridRowModesModel;
  api: DataGridAPI<T>;
  deleteConfirmMessage: string;
  deleteErrorMessage: string;
  deleteUndoOptions: DeleteUndoOptions | undefined;
  t: TFunction;
  setRows: React.Dispatch<React.SetStateAction<GridRowsProp<T>>>;
  setStableRowOrder: React.Dispatch<React.SetStateAction<GridRowId[]>>;
  setRowModesModel: React.Dispatch<React.SetStateAction<GridRowModesModel>>;
  setError: (error: string) => void;
  clearRowInteractionState: (rowId: GridRowId) => void;
  moveFocusAwayFromRemovedRow: (rowId: GridRowId, remainingRows: readonly T[]) => void;
}

export function useDataGridDelete<T extends EditableRow>({
  rowsById,
  rows,
  stableRowOrder,
  rowModesModel,
  api,
  deleteConfirmMessage,
  deleteErrorMessage,
  deleteUndoOptions,
  t,
  setRows,
  setStableRowOrder,
  setRowModesModel,
  setError,
  clearRowInteractionState,
  moveFocusAwayFromRemovedRow,
}: UseDataGridDeleteParams<T>) {
  const [pendingDeleteWithUndo, setPendingDeleteWithUndo] = useState<PendingDeleteWithUndo<T>[]>([]);
  const pendingDeleteTimersRef = useRef<Map<string, number>>(new Map());
  const deleteRowCommandRef = useRef<(rowId: GridRowId) => void>(() => undefined);

  useEffect(() => {
    const pendingDeleteTimers = pendingDeleteTimersRef.current;
    return () => {
      pendingDeleteTimers.forEach((timerId) => window.clearTimeout(timerId));
      pendingDeleteTimers.clear();
    };
  }, []);

  const removePendingDeleteWithUndo = useCallback((deletionId: string): void => {
    setPendingDeleteWithUndo((current) =>
      current.filter((deletion) => deletion.id !== deletionId),
    );
  }, []);

  const restorePendingDeleteWithUndo = useCallback((deletion: PendingDeleteWithUndo<T>): void => {
    setRows((currentRows) => {
      if (currentRows.some((row) => String(row.id) === String(deletion.rowId))) {
        return currentRows;
      }
      const rowsById = new Map((currentRows as T[]).map((row) => [String(row.id), row]));
      rowsById.set(String(deletion.rowId), deletion.row);
      const orderedIds = deletion.rowsBeforeDelete.map((row) => row.id);
      const orderedRows = orderedIds
        .map((id) => rowsById.get(String(id)))
        .filter((row): row is T => row !== undefined);
      const orderedIdKeys = new Set(orderedIds.map(String));
      const missingRows = (currentRows as T[]).filter((row) => !orderedIdKeys.has(String(row.id)));
      return [...orderedRows, ...missingRows];
    });
    setStableRowOrder((currentOrder) => {
      const currentOrderKeys = new Set(currentOrder.map(String));
      currentOrderKeys.add(String(deletion.rowId));
      const restoredOrder = deletion.stableRowOrderBeforeDelete.filter((id) =>
        currentOrderKeys.has(String(id)),
      );
      const restoredOrderKeys = new Set(restoredOrder.map(String));
      return [
        ...restoredOrder,
        ...currentOrder.filter((id) => !restoredOrderKeys.has(String(id))),
      ];
    });
    if (deletion.rowModeBeforeDelete) {
      setRowModesModel((current) => ({
        ...current,
        [deletion.rowId]: deletion.rowModeBeforeDelete!,
      }));
    }
  }, [setRowModesModel, setRows, setStableRowOrder]);

  const finalizeDeleteWithUndo = useCallback(async (deletion: PendingDeleteWithUndo<T>): Promise<void> => {
    pendingDeleteTimersRef.current.delete(deletion.id);
    removePendingDeleteWithUndo(deletion.id);

    const numericId = Number(deletion.rowId);
    if (numericId < 0) {
      return;
    }

    try {
      await api.delete(numericId);
      setError('');
    } catch (err) {
      restorePendingDeleteWithUndo(deletion);
      setError(extractApiErrorMessage(err, t, deleteErrorMessage));
      console.error('Error deleting data:', err);
    }
  }, [api, deleteErrorMessage, removePendingDeleteWithUndo, restorePendingDeleteWithUndo, setError, t]);

  const closeDeleteWithUndoSnackbar = useCallback((deletionId: string): void => {
    setPendingDeleteWithUndo((current) =>
      current.map((deletion) =>
        deletion.id === deletionId ? { ...deletion, visible: false } : deletion,
      ),
    );
  }, []);

  const undoDeleteWithUndo = useCallback((deletionId: string): void => {
    const deletion = pendingDeleteWithUndo.find((d) => d.id === deletionId);
    if (!deletion) {
      return;
    }

    const timerId = pendingDeleteTimersRef.current.get(deletionId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      pendingDeleteTimersRef.current.delete(deletionId);
    }

    restorePendingDeleteWithUndo(deletion);
    removePendingDeleteWithUndo(deletionId);
  }, [pendingDeleteWithUndo, removePendingDeleteWithUndo, restorePendingDeleteWithUndo]);

  const handleDeleteClick = useCallback((id: GridRowId) => (): void => {
    const rowKey = String(id);
    const row = rowsById.get(rowKey) as T | undefined;
    if (!row) {
      return;
    }

    if (isUnsavedDraftRow(row)) {
      const remainingRows = (rows as T[]).filter((r) => String(r.id) !== rowKey);
      moveFocusAwayFromRemovedRow(id, remainingRows);
      clearRowInteractionState(id);
      setRows(remainingRows);
      setStableRowOrder((previous) => previous.filter((orderedId) => String(orderedId) !== rowKey));
      setError('');
      return;
    }

    if (deleteUndoOptions) {
      const deletionId = `${rowKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const pendingDeletion: PendingDeleteWithUndo<T> = {
        id: deletionId,
        rowId: id,
        row,
        rowsBeforeDelete: rows as T[],
        stableRowOrderBeforeDelete: stableRowOrder,
        rowModeBeforeDelete: rowModesModel[id],
        visible: true,
      };

      const remainingRows = (rows as T[]).filter((r) => String(r.id) !== rowKey);
      moveFocusAwayFromRemovedRow(id, remainingRows);
      setRows((prev) => prev.filter((r) => String(r.id) !== rowKey));
      setStableRowOrder((previous) => previous.filter((orderedId) => String(orderedId) !== rowKey));
      clearRowInteractionState(id);
      setError('');
      setPendingDeleteWithUndo((current) => [...current, pendingDeletion]);

      const timerId = window.setTimeout(() => {
        void finalizeDeleteWithUndo(pendingDeletion);
      }, DELETE_UNDO_DURATION_MS);
      pendingDeleteTimersRef.current.set(deletionId, timerId);
      return;
    }

    if (!confirmAction(deleteConfirmMessage)) return;

    const numericId = Number(id);
    if (numericId < 0) {
      const remainingRows = (rows as T[]).filter((r) => String(r.id) !== rowKey);
      moveFocusAwayFromRemovedRow(id, remainingRows);
      clearRowInteractionState(id);
      setRows(remainingRows);
      setStableRowOrder((previous) => previous.filter((orderedId) => String(orderedId) !== rowKey));
      return;
    }

    api.delete(numericId)
      .then(() => {
        const remainingRows = (rows as T[]).filter((r) => String(r.id) !== rowKey);
        moveFocusAwayFromRemovedRow(id, remainingRows);
        clearRowInteractionState(id);
        setRows(remainingRows);
        setStableRowOrder((previous) => previous.filter((orderedId) => String(orderedId) !== rowKey));
        setError('');
      })
      .catch((err) => {
        setError(deleteErrorMessage);
        console.error('Error deleting data:', err);
      });
  }, [
    api,
    clearRowInteractionState,
    deleteConfirmMessage,
    deleteErrorMessage,
    deleteUndoOptions,
    finalizeDeleteWithUndo,
    moveFocusAwayFromRemovedRow,
    rowModesModel,
    rows,
    rowsById,
    setError,
    setRows,
    setStableRowOrder,
    stableRowOrder,
  ]);

  useEffect(() => {
    deleteRowCommandRef.current = (rowId) => handleDeleteClick(rowId)();
  }, [handleDeleteClick]);

  return {
    pendingDeleteWithUndo,
    handleDeleteClick,
    deleteRowCommandRef,
    closeDeleteWithUndoSnackbar,
    undoDeleteWithUndo,
  };
}
