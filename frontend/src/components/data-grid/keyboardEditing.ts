// Excel-like "just start typing" (replace cell value) and F2 (edit in place)
// entry points for EditableDataGrid. See docs/datagrid-architecture.md
// ("Keyboard editing/navigation inside the grid") for the broader picture.
import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { flushSync } from 'react-dom';
import { GridRowModes } from '@mui/x-data-grid';
import type { GridCellParams, GridRowId, GridRowModesModel, GridValidRowModel } from '@mui/x-data-grid';

type DataGridKeyboardEvent = React.KeyboardEvent & {
  defaultMuiPrevented?: boolean;
};

interface SpreadsheetEditApi {
  isCellEditable?: (params: GridCellParams) => boolean;
  setCellFocus?: (id: GridRowId, field: string) => void;
  setEditCellValue?: (params: { id: GridRowId; field: string; value: unknown }) => Promise<boolean> | boolean | void;
}

interface PendingEditValue {
  id: GridRowId;
  field: string;
  value: string;
}

interface UseSpreadsheetEditStarterParams<Row extends GridValidRowModel> {
  apiRef: {
    current?: SpreadsheetEditApi | null;
  };
  rowModesModel: GridRowModesModel;
  setRowModesModel: React.Dispatch<React.SetStateAction<GridRowModesModel>>;
  isCellEditable?: (params: GridCellParams<Row>) => boolean;
  onBeforeEdit?: (params: GridCellParams<Row>) => void;
  onReplaceValue?: (params: GridCellParams<Row>, value: string) => void;
}

interface UseSpreadsheetEditStarterResult<Row extends GridValidRowModel> {
  startEditFromPrintableKey: (
    params: GridCellParams<Row>,
    event: React.KeyboardEvent,
  ) => boolean;
  startEditFromF2: (
    params: GridCellParams<Row>,
    event: React.KeyboardEvent,
  ) => boolean;
}

const getPendingKey = (id: GridRowId, field: string): string => `${String(id)}\u0000${field}`;

const isRowEditing = (rowModesModel: GridRowModesModel, rowId: GridRowId): boolean =>
  rowModesModel[rowId]?.mode === GridRowModes.Edit
  || rowModesModel[String(rowId)]?.mode === GridRowModes.Edit;

const isSpreadsheetPrintableKey = (event: DataGridKeyboardEvent): boolean => (
  event.key.length === 1
  && event.key !== ' '
  && !event.altKey
  && !event.ctrlKey
  && !event.metaKey
  && !event.nativeEvent?.isComposing
);

const markMuiEventHandled = (event: DataGridKeyboardEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  event.defaultMuiPrevented = true;
};

export function useSpreadsheetEditStarter<Row extends GridValidRowModel>({
  apiRef,
  rowModesModel,
  setRowModesModel,
  isCellEditable,
  onBeforeEdit,
  onReplaceValue,
}: UseSpreadsheetEditStarterParams<Row>): UseSpreadsheetEditStarterResult<Row> {
  const pendingValuesRef = useRef<Map<string, PendingEditValue>>(new Map());
  const clearTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => () => {
    clearTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    clearTimersRef.current.clear();
    pendingValuesRef.current.clear();
  }, []);

  const clearPendingLater = useCallback((pendingKey: string): void => {
    const existingTimer = clearTimersRef.current.get(pendingKey);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    const timerId = window.setTimeout(() => {
      clearTimersRef.current.delete(pendingKey);
      pendingValuesRef.current.delete(pendingKey);
    }, 250);
    clearTimersRef.current.set(pendingKey, timerId);
  }, []);

  const flushPendingValue = useCallback((pendingKey: string): void => {
    const applyPendingValue = (): void => {
      const pendingValue = pendingValuesRef.current.get(pendingKey);
      const api = apiRef.current;
      if (!pendingValue || !api?.setEditCellValue) {
        return;
      }

      const valueAtFlushStart = pendingValue.value;
      void Promise.resolve(api.setEditCellValue({
        id: pendingValue.id,
        field: pendingValue.field,
        value: valueAtFlushStart,
      }));
    };

    applyPendingValue();
    queueMicrotask(applyPendingValue);
    window.setTimeout(applyPendingValue, 0);
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(applyPendingValue);
    }
  }, [apiRef]);

  const canStartEdit = useCallback((params: GridCellParams<Row>): boolean => {
    if (!params.isEditable || isRowEditing(rowModesModel, params.id)) {
      return false;
    }
    if (isCellEditable && !isCellEditable(params)) {
      return false;
    }
    return apiRef.current?.isCellEditable?.(params as GridCellParams) ?? true;
  }, [apiRef, isCellEditable, rowModesModel]);

  const startEdit = useCallback((params: GridCellParams<Row>): boolean => {
    if (!canStartEdit(params)) {
      return false;
    }

    onBeforeEdit?.(params);
    apiRef.current?.setCellFocus?.(params.id, params.field);
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [params.id]: { mode: GridRowModes.Edit, fieldToFocus: params.field },
    }));
    return true;
  }, [apiRef, canStartEdit, onBeforeEdit, setRowModesModel]);

  const startEditFromPrintableKey = useCallback((
    params: GridCellParams<Row>,
    event: React.KeyboardEvent,
  ): boolean => {
    const keyboardEvent = event as DataGridKeyboardEvent;
    if (!isSpreadsheetPrintableKey(keyboardEvent)) {
      return false;
    }

    const pendingKey = getPendingKey(params.id, params.field);
    const pendingValue = pendingValuesRef.current.get(pendingKey);
    if (!pendingValue && !canStartEdit(params)) {
      return false;
    }

    markMuiEventHandled(keyboardEvent);
    if (!pendingValue) {
      onBeforeEdit?.(params);
      apiRef.current?.setCellFocus?.(params.id, params.field);
      // flushSync forces the row-mode change to commit synchronously so the edit
      // cell exists in the DOM before we try to seed its value below. Without it,
      // fast typing can race ahead of React's own render and the first keystroke
      // (or several, on a slow render) would land before there's an input to type
      // into — the pendingValuesRef buffer below exists specifically to survive
      // that gap regardless, but flushSync keeps the common case tight.
      flushSync(() => {
        setRowModesModel((oldModel) => ({
          ...oldModel,
          [params.id]: { mode: GridRowModes.Edit, fieldToFocus: params.field },
        }));
      });
    }

    const previousValue = pendingValue?.value ?? '';
    const nextValue = `${previousValue}${keyboardEvent.key}`;
    pendingValuesRef.current.set(pendingKey, {
      id: params.id,
      field: params.field,
      value: nextValue,
    });
    onReplaceValue?.(params, nextValue);
    flushPendingValue(pendingKey);
    clearPendingLater(pendingKey);
    return true;
  }, [
    apiRef,
    canStartEdit,
    clearPendingLater,
    flushPendingValue,
    onBeforeEdit,
    onReplaceValue,
    setRowModesModel,
  ]);

  const startEditFromF2 = useCallback((
    params: GridCellParams<Row>,
    event: React.KeyboardEvent,
  ): boolean => {
    const keyboardEvent = event as DataGridKeyboardEvent;
    if (
      keyboardEvent.key !== 'F2'
      || keyboardEvent.altKey
      || keyboardEvent.ctrlKey
      || keyboardEvent.metaKey
      || !startEdit(params)
    ) {
      return false;
    }

    markMuiEventHandled(keyboardEvent);
    return true;
  }, [startEdit]);

  return {
    startEditFromPrintableKey,
    startEditFromF2,
  };
}
