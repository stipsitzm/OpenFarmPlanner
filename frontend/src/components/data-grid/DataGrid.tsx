/**
 * Reusable Editable Data Grid component.
 * 
 * Provides Excel-like inline editing with validation and API integration.
 * Supports spreadsheet-like autosave on blur.
 * Can be used for any entity type with proper configuration.
 * UI text is in German, code comments remain in English.
 * 
 * @template T The type of data rows
 * @returns A configurable editable data grid component
 * 
 * @remarks
 * Changes are saved through the row save action.
 * Keyboard navigation commits edit values locally without calling the API.
 * Navigation is blocked if there are unsaved changes (row in edit mode).
 */

import { useState, useEffect, useCallback, useRef, useMemo, type KeyboardEvent, type ReactNode } from 'react';
import {
  DataGrid,
  GridRowEditStopReasons,
  GridRowModes,
  useGridApiRef,
} from '@mui/x-data-grid';
import { dataGridSx, dataGridFooterSx, deleteIconButtonSx } from './styles';
import { handleRowEditStop, handleEditableCellClick } from './handlers';
import type { GridColDef, GridRowsProp, GridRowModesModel, GridRowId, GridSortModel, GridFilterModel, GridCellParams, GridRenderCellParams, GridRowParams, GridPaginationModel } from '@mui/x-data-grid';
import { Box, Alert, IconButton, Chip, Button, Tooltip, useMediaQuery, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useNavigationBlocker } from '../../hooks/autosave';
import { usePersistentSortModel } from '../../hooks/usePersistentSortModel';
import { useTranslation } from '../../i18n';
import { NotesCell } from './NotesCell';
import { NotesDrawer } from './NotesDrawer';
import {
  DeleteUndoSnackbar,
} from './DeleteUndoSnackbar';
import { getPlainExcerpt } from './markdown';
import { useNotesEditor } from './useNotesEditor';
import { extractApiErrorMessage } from '../../api/errors';
import { germanDataGridLocaleText } from './localeText';
import { TableCopyMenuItems } from './TableCopyMenuItems';
import { formatClipboardValue, type TableClipboardRow } from './tableClipboard';
import { handleContextMenuKeyboardNavigation } from './contextMenuFocus';
import { ContextMenuHint } from './ContextMenuHint';
import { useContextMenuHint } from './useContextMenuHint';
import { useDataGridCommandApi } from './hooks/useDataGridCommandApi';
import { useDataGridDelete } from './hooks/useDataGridDelete';
import { useDataGridRowActionMenu } from './hooks/useDataGridRowActionMenu';
import {
  getSortedRowIds,
  isSaveBlockedError,
  isUnsavedDraftRow,
  orderRowsByStableIds,
  prepareDataGridColumn,
  SaveBlockedError,
} from './dataGridUtils';
import {
  focusKeyboardNavigableCell as focusDataGridKeyboardNavigableCell,
  getKeyboardNavigationTarget,
  getVerticalKeyboardNavigationTarget,
  isCellKeyboardNavigable,
  isInteractiveCellTarget,
  preventReadOnlyCellMouseFocus,
} from './keyboardNavigation';
import type {
  EditableDataGridClipboardColumn,
  EditableDataGridProps,
  EditableDataGridRowAction,
  EditableDataGridRowActionHelpers,
  EditableRow,
} from './types';

export type {
  DataGridAPI,
  DeleteUndoOptions,
  EditableDataGridClipboardColumn,
  EditableDataGridCommandApi,
  EditableDataGridProps,
  EditableDataGridRowAction,
  EditableDataGridRowActionHelpers,
  EditableRow,
  NotesFieldConfig,
} from './types';

const editModeEditorArrowKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

type DataGridKeyboardEvent = KeyboardEvent & {
  defaultMuiPrevented?: boolean;
};

const isComboboxInteractionTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]'),
  );
};

const isEnterSaveInputTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement && !isComboboxInteractionTarget(target);

export function EditableDataGrid<T extends EditableRow>({
  columns,
  api,
  createNewRow,
  mapToRow,
  mapToApiData,
  validateRow,
  loadErrorMessage,
  saveErrorMessage,
  deleteErrorMessage,
  deleteConfirmMessage,
  addButtonLabel,
  showDeleteAction = true,
  initialRow,
  tableKey,
  defaultSortModel = [],
  persistSortInUrl = true,
  notes,
  commandApiRef,
  onSelectedRowChange,
  getRowValidationErrors,
  showAddAction = true,
  showFooterEditControls = true,
  showRowEditActions = false,
  getRowActions,
  inlineRowActionField,
  getInlineRowActions,
  showInlineRowActionMenu = false,
  duplicateRow,
  deleteUndoOptions,
  clipboardColumns,
  onRowsStateChange,
  onLoadStateChange,
  onBeforeSaveRow,
  isSaveErrorHandled,
  surfaceSizing,
  paginationPageSizeOptions,
  initialPageSize = 25,
}: EditableDataGridProps<T>) {
  const gridApiRef = useGridApiRef();
  const resolvedSurfaceSizing = surfaceSizing ?? 'contentFit';
  const isContentSizedSurface = resolvedSurfaceSizing === 'contentFit' || resolvedSurfaceSizing === 'compact';
  const shouldUseCompactContainer = resolvedSurfaceSizing === 'compact';
  const shouldDisableTrailingFiller = isContentSizedSurface;
  const [rows, setRows] = useState<GridRowsProp<T>>([]);
  const [stableRowOrder, setStableRowOrder] = useState<GridRowId[]>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [dataFetched, setDataFetched] = useState<boolean>(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: initialPageSize,
  });
  const initialRowProcessedRef = useRef<boolean>(false);
  const initialFetchDoneRef = useRef<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<GridRowId[]>([]);
  const [dirtyRowIds, setDirtyRowIds] = useState<Set<string>>(new Set());
  const [activeValidationErrors, setActiveValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const rowSnapshotRef = useRef<Map<string, T>>(new Map());
  const canceledRowIdsRef = useRef<Set<string>>(new Set());
  const gridSurfaceRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery('(max-width:900px)');
  
  const { t } = useTranslation('common');
  const { sortModel, setSortModel, filterModel, setFilterModel } = usePersistentSortModel({
    tableKey: tableKey ?? 'editableDataGrid',
    defaultSortModel,
    allowedFields: columns.map((column) => column.field),
    persistInUrl: persistSortInUrl,
  });
  const rowsForGrid = useMemo(
    () => orderRowsByStableIds(rows as T[], stableRowOrder),
    [rows, stableRowOrder],
  );
  useEffect(() => {
    if (!import.meta.env.DEV || !paginationPageSizeOptions || loading) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const visibleRowCount = Math.max(
        0,
        Math.min(
          paginationModel.pageSize,
          rowsForGrid.length - paginationModel.page * paginationModel.pageSize,
        ),
      );
      console.debug('[DataGrid diagnostics]', {
        table: tableKey ?? 'editableDataGrid',
        totalRows: rowsForGrid.length,
        visibleRows: visibleRowCount,
        page: paginationModel.page + 1,
        pageSize: paginationModel.pageSize,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    gridApiRef,
    loading,
    paginationModel,
    paginationPageSizeOptions,
    rowsForGrid,
    tableKey,
  ]);
  const hasContextMenuHintRows = useMemo(
    () => rowsForGrid.some((row) => !isUnsavedDraftRow(row)),
    [rowsForGrid],
  );
  const { showContextMenuHint, closeContextMenuHint, markContextMenuHintUsed } = useContextMenuHint({
    enabled: dataFetched && !error,
    isLoading: loading,
    hasRows: hasContextMenuHintRows,
  });
  const refreshStableRowOrder = useCallback((sourceRows: readonly T[], model: GridSortModel = sortModel): void => {
    setStableRowOrder(getSortedRowIds(sourceRows, model));
  }, [sortModel]);

  const saveUpdatedRow = useCallback(async (updatedRow: T): Promise<T> => {
    const numericId = Number(updatedRow.id);
    if (numericId < 0 || updatedRow.isNew) {
      setRows((prevRows) =>
        prevRows.map((row) => (row.id === updatedRow.id ? updatedRow : row))
      );
      return updatedRow;
    }

    const apiData = await mapToApiData(updatedRow);
    const response = await api.update(numericId, apiData);
    if (!response.data.id) {
      throw new Error('API response missing ID');
    }

    const savedRow = mapToRow(response.data as T);
    setRows((prevRows) =>
      prevRows.map((row) => (row.id === updatedRow.id ? savedRow : row))
    );
    setError('');
    return savedRow;
  }, [api, mapToApiData, mapToRow]);

  const notesEditor = useNotesEditor({
    rows,
    onSave: async ({ row, field, value }) => {
      const updatedRow = { ...row, [field]: value } as T;
      await saveUpdatedRow(updatedRow);
    },
    onError: (errorMessage) => {
      const extractedError = extractApiErrorMessage(errorMessage, t, saveErrorMessage);
      setError(extractedError);
    },
  });

  const hasRowsInEditMode = Object.values(rowModesModel).some(
    (mode) => mode.mode === GridRowModes.Edit
  );
  const hasUnsavedChanges = hasRowsInEditMode || dirtyRowIds.size > 0;
  const notesFieldNames = useMemo(
    () => notes?.fields.map((fieldConfig) => fieldConfig.field) ?? [],
    [notes],
  );

  // Check if there's a validation error (indicating incomplete/invalid data)
  const hasValidationError = Boolean(error);
  
  // Check if any row in edit mode has validation errors
  // This prevents navigation when user has incomplete data even if blur hasn't happened yet
  const rowsById = useMemo(() => {
    return new Map(rows.map((row) => [String(row.id), row]));
  }, [rows]);
  const handleSortModelChange = useCallback((nextSortModel: GridSortModel): void => {
    setSortModel(nextSortModel);
    refreshStableRowOrder(rows as T[], nextSortModel);
  }, [refreshStableRowOrder, rows, setSortModel]);
  const handleFilterModelChange = useCallback((nextFilterModel: GridFilterModel): void => {
    setFilterModel(nextFilterModel);
    refreshStableRowOrder(rows as T[]);
  }, [refreshStableRowOrder, rows, setFilterModel]);

  const clearSavedRowInteractionState = useCallback((rowId: GridRowId, savedRowId: GridRowId = rowId): void => {
    const rowKey = String(rowId);
    const savedRowKey = String(savedRowId);

    setDirtyRowIds((prev) => {
      const next = new Set(prev);
      next.delete(rowKey);
      next.delete(savedRowKey);
      return next;
    });
    setActiveValidationErrors((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      delete next[savedRowKey];
      return next;
    });
    setSelectedRowIds([]);

    const api = gridApiRef.current as typeof gridApiRef.current & {
      state?: { focus?: { cell?: { id?: GridRowId; field?: string } | null } };
    };
    const focusedCell = api?.state?.focus?.cell;
    if (
      focusedCell &&
      (String(focusedCell.id) === rowKey || String(focusedCell.id) === savedRowKey)
    ) {
      api.state.focus.cell = null;
    }

    if (document.activeElement instanceof HTMLElement) {
      const gridSurface = gridSurfaceRef.current;
      if (!gridSurface || gridSurface.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }
  }, [gridApiRef]);

  const getFocusedCellFromEvent = useCallback((event: KeyboardEvent): { id: GridRowId; field: string } | null => {
    const api = gridApiRef.current;
    const focusedCell = api?.state.focus.cell;
    if (focusedCell) {
      return focusedCell;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const cellElement = target.closest<HTMLElement>('[role="gridcell"][data-field]');
    const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
    const field = cellElement?.dataset.field;
    const id = rowElement?.dataset.id;
    if (!field || id === undefined) {
      return null;
    }

    const numericId = Number(id);
    return {
      id: Number.isNaN(numericId) ? id : numericId,
      field,
    };
  }, [gridApiRef]);

  const isActionCellKeyboardNavigable = useCallback((params: GridCellParams<T>): boolean => (
    notesFieldNames.includes(params.field)
  ), [notesFieldNames]);

  const getKeyboardNavigableFieldsForRow = useCallback((rowId: GridRowId): string[] => {
    const api = gridApiRef.current;
    if (!api) {
      return [];
    }
    return api.getVisibleColumns()
      .filter((column) => {
        return isCellKeyboardNavigable<T>({
          api,
          field: column.field,
          isActionCell: isActionCellKeyboardNavigable,
          rowId,
        });
      })
      .map((column) => column.field);
  }, [gridApiRef, isActionCellKeyboardNavigable]);

  const focusKeyboardNavigableCell = useCallback((
    rowId: GridRowId,
    field: string,
    options: { startEdit: boolean },
  ): void => {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    const rowKey = String(rowId);
    const row = rowsById.get(rowKey);
    if (row && !rowSnapshotRef.current.has(rowKey)) {
      rowSnapshotRef.current.set(rowKey, row as T);
    }

    const rowIndex = api.getRowIndexRelativeToVisibleRows(rowId);
    const colIndex = api.getColumnIndexRelativeToVisibleColumns(field);
    api.scrollToIndexes({ rowIndex, colIndex });
    api.setCellFocus(rowId, field);

    if (!options.startEdit || notesFieldNames.includes(field)) {
      return;
    }

    if (rowModesModel[rowId]?.mode === GridRowModes.Edit) {
      return;
    }

    setRowModesModel((oldModel) => ({
      ...oldModel,
      [rowId]: { mode: GridRowModes.Edit, fieldToFocus: field },
    }));
  }, [gridApiRef, notesFieldNames, rowModesModel, rowsById]);

  const getHorizontalNavigationTarget = useCallback((
    rowId: GridRowId,
    field: string,
    direction: 1 | -1,
  ): { id: GridRowId; field: string } | null => {
    const editableFields = getKeyboardNavigableFieldsForRow(rowId);
    const fieldIndex = editableFields.indexOf(field);
    if (fieldIndex === -1) {
      return null;
    }

    const nextField = editableFields[fieldIndex + direction];
    if (nextField) {
      return { id: rowId, field: nextField };
    }

    return null;
  }, [getKeyboardNavigableFieldsForRow]);

  const handleReadOnlyCellMouseDown = useCallback((event: React.MouseEvent<HTMLElement>): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (isInteractiveCellTarget(target)) {
      return;
    }

    const cellElement = target.closest<HTMLElement>('[role="gridcell"][data-field]');
    const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
    const field = cellElement?.dataset.field;
    const id = rowElement?.dataset.id;
    if (!field || id === undefined) {
      return;
    }

    const numericId = Number(id);
    const rowId = Number.isNaN(numericId) ? id : numericId;
    if (isCellKeyboardNavigable<T>({
      api: gridApiRef.current,
      field,
      isActionCell: isActionCellKeyboardNavigable,
      rowId,
    })) {
      return;
    }

    preventReadOnlyCellMouseFocus(event);
  }, [gridApiRef, isActionCellKeyboardNavigable]);

  const hasInvalidRowInEditMode = useMemo(() => {
    if (!hasRowsInEditMode) return false;
    
    // Find rows that are in edit mode
    const editingRowIds = Object.entries(rowModesModel)
      .filter(([, mode]) => mode.mode === GridRowModes.Edit)
      .map(([id]) => id);
    
    // Check if any of those rows have validation errors
    return editingRowIds.some(id => {
      const row = rowsById.get(String(id));
      if (!row) return false;
      const validationError = validateRow(row);
      return validationError !== null;
    });
  }, [hasRowsInEditMode, rowModesModel, rowsById, validateRow]);

  // Do not block navigation with modal prompts: invalid/dirty state is visible inline.
  useNavigationBlocker(
    hasUnsavedChanges,
    t('messages.unsavedChanges')
  );

  const rowValidationErrors = useMemo(() => {
    if (!getRowValidationErrors) return {};
    const errorsByRow: Record<string, Record<string, string>> = {};
    for (const row of rows as T[]) {
      const errors = getRowValidationErrors(row);
      if (Object.keys(errors).length > 0) {
        errorsByRow[String(row.id)] = errors;
      }
    }
    return errorsByRow;
  }, [getRowValidationErrors, rows]);

  /**
   * Fetch data from API and populate grid
   */
  const fetchData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await api.list();
      const dataRows: T[] = response.data.results
        .filter((item): item is T & { id: number } => item.id !== undefined)
        .map(mapToRow);
      setRows(dataRows);
      refreshStableRowOrder(dataRows);
      setError('');
      setDataFetched(true);
    } catch (err) {
      setError(loadErrorMessage);
      console.error('Error fetching data:', err);
      setDataFetched(true);
    } finally {
      setLoading(false);
    }
  }, [api, mapToRow, loadErrorMessage, refreshStableRowOrder]);

  useEffect(() => {
    // Only fetch on initial mount
    if (!initialFetchDoneRef.current) {
      initialFetchDoneRef.current = true;
      fetchData();
    }
  }, [fetchData]);

  /**
   * Add initial row if provided and not already processed
   * Only runs once when initialRow is provided and data has finished loading
   */
  useEffect(() => {
    if (initialRow && !initialRowProcessedRef.current && dataFetched && !loading) {
      initialRowProcessedRef.current = true;
      const newRow = { ...createNewRow(), ...initialRow };
      setRows((oldRows) => [...oldRows, newRow]);
      setStableRowOrder((previousOrder) => [...previousOrder, newRow.id]);
      // Set row to edit mode after a small delay to ensure row is added first
      setTimeout(() => {
        setRowModesModel((oldModel) => ({
          ...oldModel,
          [newRow.id]: { mode: GridRowModes.Edit },
        }));
      }, 0);
    }
  }, [initialRow, dataFetched, loading, createNewRow]);

  /**
   * Handle adding a new row to the grid
   */
  const handleAddClick = useCallback((): void => {
    const newRow = createNewRow();
    setRows((oldRows) => [...oldRows, newRow]);
    setStableRowOrder((previousOrder) => [...previousOrder, newRow.id]);
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [newRow.id]: { mode: GridRowModes.Edit, fieldToFocus: columns[0]?.field },
    }));
    if (paginationPageSizeOptions) {
      setPaginationModel((current) => ({
        ...current,
        page: Math.floor(rows.length / current.pageSize),
      }));
    }
  }, [columns, createNewRow, paginationPageSizeOptions, rows.length]);

  const handleDiscardRowChanges = useCallback((rowId: GridRowId): void => {
    const rowKey = String(rowId);
    canceledRowIdsRef.current.add(rowKey);
    setError('');
    // Escape's default MUI behavior (which normally restores keyboard focus
    // to the cell) is intentionally suppressed above so Escape can cancel
    // instead of just exiting edit mode — so focus has to be restored here,
    // or it's left stranded outside the grid entirely once the edit input
    // unmounts.
    const currentRowMode = rowModesModel[rowId];
    const fieldToRestoreFocus = (currentRowMode?.mode === GridRowModes.Edit ? currentRowMode.fieldToFocus : undefined)
      ?? columns.find((column) => column.editable !== false)?.field;
    const snapshot = rowSnapshotRef.current.get(rowKey);
    const currentRow = rowsById.get(rowKey) ?? snapshot;
    const rowWasRemoved = Boolean(currentRow && isUnsavedDraftRow(currentRow));

    if (rowWasRemoved) {
      setRows((prevRows) => prevRows.filter((row) => String(row.id) !== rowKey));
      setStableRowOrder((previousOrder) => previousOrder.filter((orderedId) => String(orderedId) !== rowKey));
      rowSnapshotRef.current.delete(rowKey);
    } else if (snapshot) {
      setRows((prevRows) => prevRows.map((row) => (String(row.id) === rowKey ? snapshot : row)));
    }

    setDirtyRowIds((prev) => {
      const next = new Set(prev);
      next.delete(rowKey);
      return next;
    });
    setActiveValidationErrors((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [rowId]: { mode: GridRowModes.View, ignoreModifications: true },
    }));
    clearSavedRowInteractionState(rowId);
    window.setTimeout(() => {
      canceledRowIdsRef.current.delete(rowKey);
    }, 0);
    if (fieldToRestoreFocus && !rowWasRemoved) {
      requestAnimationFrame(() => {
        gridApiRef.current?.setCellFocus(rowId, fieldToRestoreFocus);
      });
    }
  }, [clearSavedRowInteractionState, columns, gridApiRef, rowModesModel, rowsById]);

  const markRowDirty = useCallback((rowKey: string): void => {
    setDirtyRowIds((previous) => {
      if (previous.has(rowKey)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(rowKey);
      return next;
    });
  }, []);

  const getDraftRow = useCallback((rowId: GridRowId): T | null => {
    const api = gridApiRef.current;
    if (!api) {
      return null;
    }
    return api.getRowWithUpdatedValues(rowId, '') as T | null;
  }, [gridApiRef]);

  const applyDraftValues = useCallback(async (rowId: GridRowId, values: Partial<T>): Promise<void> => {
    const rowKey = String(rowId);
    const isEditing = rowModesModel[rowId]?.mode === GridRowModes.Edit;
    const targetRow = rowsById.get(rowKey) as T | undefined;
    const api = gridApiRef.current;

    if (isEditing && api) {
      const editUpdates = Object.entries(values).flatMap(([fieldKey, fieldValue]) => {
        if (fieldKey === 'id' || fieldKey === 'isNew') {
          return [];
        }
        return [
          api.setEditCellValue({
            id: rowId,
            field: fieldKey,
            value: fieldValue,
          }),
        ];
      });
      await Promise.allSettled(editUpdates);
    }

    setRows((previousRows) =>
      previousRows.map((row) =>
        String(row.id) === rowKey ? ({ ...row, ...values } as T) : row,
      ),
    );
    if (targetRow) {
      const nextRow = { ...targetRow, ...values } as T;
      const fieldErrors = getRowValidationErrors?.(nextRow) ?? {};
      setActiveValidationErrors((prev) => ({
        ...prev,
        [rowKey]: fieldErrors,
      }));
    }
    markRowDirty(rowKey);
  }, [getRowValidationErrors, gridApiRef, markRowDirty, rowModesModel, rowsById]);

  const runBeforeSaveGate = useCallback(async (row: T): Promise<T | null> => {
    if (!onBeforeSaveRow) {
      return row;
    }
    const saveDecision = await onBeforeSaveRow(row);
    if (saveDecision === false) {
      return null;
    }
    if (saveDecision !== true && saveDecision !== null && typeof saveDecision === 'object') {
      return { ...row, ...saveDecision } as T;
    }
    return row;
  }, [onBeforeSaveRow]);

  const prepareRowForSave = useCallback(async (rowId: GridRowId): Promise<T | null> => {
    const draftRow = getDraftRow(rowId);
    if (!draftRow) {
      return rowsById.get(String(rowId)) as T | undefined ?? null;
    }
    return draftRow;
  }, [getDraftRow, rowsById]);

  const commitEditedRowDraftForKeyboardNavigation = useCallback((
    rowId: GridRowId,
    options: { syncRows: boolean },
  ): boolean => {
    const rowKey = String(rowId);
    setError((currentError) => (currentError ? '' : currentError));
    markRowDirty(rowKey);

    if (!options.syncRows) {
      return true;
    }

    const draftRow = getDraftRow(rowId);
    if (!draftRow) {
      return true;
    }

    setRows((prevRows) =>
      prevRows.map((row) => (String(row.id) === rowKey ? draftRow : row)),
    );
    return true;
  }, [getDraftRow, markRowDirty]);

  const navigateFromEditedCell = useCallback((
    current: { id: GridRowId; field: string },
    target: { id: GridRowId; field: string },
    options: { startTargetEdit: boolean },
  ): void => {
    if (current.id === target.id && current.field === target.field) {
      return;
    }

    const isSameRow = String(current.id) === String(target.id);
    const canCommitCurrentDraft = commitEditedRowDraftForKeyboardNavigation(current.id, {
      syncRows: !isSameRow,
    });
    if (!canCommitCurrentDraft) {
      return;
    }

    if (isSameRow) {
      focusKeyboardNavigableCell(target.id, target.field, {
        startEdit: options.startTargetEdit,
      });
      return;
    }

    if (rowModesModel[current.id]?.mode === GridRowModes.Edit) {
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [current.id]: { mode: GridRowModes.View, ignoreModifications: true },
      }));
    }

    focusKeyboardNavigableCell(target.id, target.field, { startEdit: options.startTargetEdit });
  }, [
    commitEditedRowDraftForKeyboardNavigation,
    focusKeyboardNavigableCell,
    rowModesModel,
  ]);

  const saveResolvedRow = useCallback(async (rowAfterSaveGate: T): Promise<T> => {
    const rowKey = String(rowAfterSaveGate.id);
    // Validate required fields
    const validationError = validateRow(rowAfterSaveGate);
    const fieldErrors = getRowValidationErrors?.(rowAfterSaveGate) ?? {};
    setActiveValidationErrors((prev) => ({
      ...prev,
      [rowKey]: fieldErrors,
    }));
    if (validationError) {
      if (rowAfterSaveGate.isNew) {
        throw new Error(validationError);
      }
      setError(validationError);
      throw new Error(validationError);
    }

    try {
      if (rowAfterSaveGate.isNew) {
        // Create new item via API
        const apiData = await mapToApiData(rowAfterSaveGate);
        const response = await api.create(apiData);
        setError('');
        if (!response.data.id) {
          throw new Error('API response missing ID');
        }

        // Remove the temporary row and add the saved row
        const savedRow = mapToRow(response.data as T);
        rowSnapshotRef.current.set(String(savedRow.id), savedRow);
        setRows((prevRows) => {
          // Remove the temporary row with negative ID
          const filteredRows = prevRows.filter(row => row.id !== rowAfterSaveGate.id);
          // Add the saved row at the beginning
          return [savedRow, ...filteredRows];
        });
        setStableRowOrder((previousOrder) =>
          previousOrder.map((orderedId) => (String(orderedId) === rowKey ? savedRow.id : orderedId)),
        );
        clearSavedRowInteractionState(rowAfterSaveGate.id, savedRow.id);

        return savedRow;
      } else {
        // Update existing item via API
        const apiData = await mapToApiData(rowAfterSaveGate);
        const response = await api.update(rowAfterSaveGate.id, apiData);
        setError('');
        if (!response.data.id) {
          throw new Error('API response missing ID');
        }
        // Map the response through mapToRow to ensure all fields are properly formatted
        // This is important for auto-calculated fields like harvest dates
        const mappedRow = mapToRow(response.data as T);
        rowSnapshotRef.current.set(String(mappedRow.id), mappedRow);
        clearSavedRowInteractionState(rowAfterSaveGate.id, mappedRow.id);
        return mappedRow;
      }
    } catch (err) {
      if (isSaveErrorHandled?.(err)) {
        throw err;
      }
      // Extract user-friendly error message
      const errorMessage = extractApiErrorMessage(err, t, saveErrorMessage);
      setError(errorMessage);
      console.error('Error saving data:', err);
      throw new Error(errorMessage);
    }
  }, [
    api,
    clearSavedRowInteractionState,
    getRowValidationErrors,
    isSaveErrorHandled,
    mapToApiData,
    mapToRow,
    saveErrorMessage,
    t,
    validateRow,
  ]);

  const processRowUpdate = useCallback(async (newRow: T): Promise<T> => {
    const rowKey = String(newRow.id);
    if (canceledRowIdsRef.current.has(rowKey)) {
      canceledRowIdsRef.current.delete(rowKey);
      setError('');
      setDirtyRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowKey);
        return next;
      });
      setActiveValidationErrors((prev) => {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      });
      return rowSnapshotRef.current.get(rowKey) ?? newRow;
    }

    // Clear previous error before validating
    // This ensures dropdown selections and other changes trigger fresh validation
    setError('');

    const rowAfterSaveGate = await runBeforeSaveGate(newRow);
    if (!rowAfterSaveGate) {
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [newRow.id]: { mode: GridRowModes.Edit },
      }));
      throw new SaveBlockedError();
    }

    const savedRow = await saveResolvedRow(rowAfterSaveGate);
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [newRow.id]: { mode: GridRowModes.View, ignoreModifications: true },
    }));
    return savedRow;
  }, [
    runBeforeSaveGate,
    saveResolvedRow,
  ]);

  const handleProcessRowUpdateError = useCallback((error: unknown): void => {
    if (isSaveBlockedError(error)) {
      return;
    }
    console.error('Row update error:', error);
    if (isSaveErrorHandled?.(error)) {
      return;
    }
    if (error instanceof Error && error.message) {
      setError(error.message);
      return;
    }
    const errorMessage = extractApiErrorMessage(error, t, saveErrorMessage);
    setError(errorMessage);
  }, [isSaveErrorHandled, saveErrorMessage, t]);

  const commitDraftValues = useCallback(async (rowId: GridRowId, values: Partial<T>): Promise<void> => {
    const rowKey = String(rowId);
    await applyDraftValues(rowId, values);

    const draftRow = getDraftRow(rowId);
    const baseRow = draftRow ?? (rowsById.get(rowKey) as T | undefined);
    if (!baseRow) {
      return;
    }

    const rowToSave = { ...baseRow, ...values } as T;
    try {
      const savedRow = await saveResolvedRow(rowToSave);
      setRows((prevRows) =>
        prevRows.map((currentRow) =>
          String(currentRow.id) === rowKey ? savedRow : currentRow,
        ),
      );
      gridApiRef.current?.stopRowEditMode({ id: rowId, ignoreModifications: true });
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [rowId]: { mode: GridRowModes.View, ignoreModifications: true },
      }));
    } catch (error) {
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [rowId]: { mode: GridRowModes.Edit },
      }));
      handleProcessRowUpdateError(error);
    }
  }, [applyDraftValues, getDraftRow, gridApiRef, handleProcessRowUpdateError, rowsById, saveResolvedRow]);

  const handleSaveRow = useCallback(async (rowId: GridRowId): Promise<void> => {
    const preparedRow = await prepareRowForSave(rowId);
    if (!preparedRow) {
      return;
    }

    try {
      const savedRow = await processRowUpdate(preparedRow);
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [rowId]: { mode: GridRowModes.View, ignoreModifications: true },
      }));
      setRows((prevRows) =>
        prevRows.some((currentRow) => String(currentRow.id) === String(rowId))
          ? prevRows.map((currentRow) =>
            String(currentRow.id) === String(rowId) ? savedRow : currentRow,
          )
          : prevRows,
      );
    } catch (error) {
      handleProcessRowUpdateError(error);
    }
  }, [
    handleProcessRowUpdateError,
    prepareRowForSave,
    processRowUpdate,
  ]);

  const saveEditedRowAndFocusTarget = useCallback(async (
    current: { id: GridRowId; field: string },
    target: { id: GridRowId; field: string },
  ): Promise<void> => {
    const preparedRow = await prepareRowForSave(current.id);
    if (!preparedRow) {
      return;
    }

    try {
      const savedRow = await processRowUpdate(preparedRow);
      setRows((prevRows) =>
        prevRows.some((currentRow) => String(currentRow.id) === String(current.id))
          ? prevRows.map((currentRow) =>
            String(currentRow.id) === String(current.id) ? savedRow : currentRow,
          )
          : prevRows,
      );
      focusKeyboardNavigableCell(target.id, target.field, {
        startEdit: !notesFieldNames.includes(target.field),
      });
    } catch (error) {
      handleProcessRowUpdateError(error);
    }
  }, [
    focusKeyboardNavigableCell,
    handleProcessRowUpdateError,
    notesFieldNames,
    prepareRowForSave,
    processRowUpdate,
  ]);

  const handleGridEditNavigation = useCallback((event: KeyboardEvent): void => {
    if (
      event.key !== 'Tab'
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || event.nativeEvent.isComposing
    ) {
      return;
    }

    const focusedCell = getFocusedCellFromEvent(event);
    if (!focusedCell || rowModesModel[focusedCell.id]?.mode !== GridRowModes.Edit) {
      return;
    }

    const direction = event.shiftKey ? -1 : 1;
    const sameRowTarget = getHorizontalNavigationTarget(focusedCell.id, focusedCell.field, direction);
    const target = sameRowTarget ?? getKeyboardNavigationTarget<T>({
      api: gridApiRef.current,
      current: focusedCell,
      direction,
      isActionCell: isActionCellKeyboardNavigable,
      rows: rowsForGrid,
      wrapRows: true,
    });

    event.preventDefault();
    event.stopPropagation();

    if (!target) {
      void handleSaveRow(focusedCell.id);
      return;
    }

    if (String(target.id) === String(focusedCell.id)) {
      navigateFromEditedCell(focusedCell, target, {
        startTargetEdit: !notesFieldNames.includes(target.field),
      });
      return;
    }

    void saveEditedRowAndFocusTarget(focusedCell, target);
  }, [
    getFocusedCellFromEvent,
    getHorizontalNavigationTarget,
    gridApiRef,
    handleSaveRow,
    isActionCellKeyboardNavigable,
    navigateFromEditedCell,
    notesFieldNames,
    rowModesModel,
    rowsForGrid,
    saveEditedRowAndFocusTarget,
  ]);

  const handleSaveAllDirtyRows = useCallback(async (): Promise<void> => {
    const editingRowIds = Object.entries(rowModesModel)
      .filter(([, mode]) => mode.mode === GridRowModes.Edit)
      .map(([id]) => id);
    const saveableRowIds: GridRowId[] = [];
    for (const rowId of editingRowIds) {
      if (await prepareRowForSave(rowId)) {
        saveableRowIds.push(rowId);
      }
    }
    if (saveableRowIds.length > 0) {
      setRowModesModel((oldModel) => {
        const nextModel = { ...oldModel };
        for (const rowId of saveableRowIds) {
          nextModel[rowId] = { mode: GridRowModes.View };
        }
        return nextModel;
      });
    }
    const editingRowIdKeys = new Set(editingRowIds.map(String));
    for (const rowKey of dirtyRowIds) {
      if (!editingRowIdKeys.has(rowKey)) {
        await handleSaveRow(rowKey);
      }
    }
  }, [dirtyRowIds, handleSaveRow, prepareRowForSave, rowModesModel]);

  const handleEditSelectedRow = useCallback((): void => {
    const selectedRowId = selectedRowIds[0];
    if (!selectedRowId) {
      return;
    }

    setRowModesModel((oldModel) => ({
      ...oldModel,
      [selectedRowId]: { mode: GridRowModes.Edit, fieldToFocus: columns[0]?.field },
    }));
  }, [columns, selectedRowIds]);

  const handleStartCellEditFromKeyboard = useCallback((params: GridCellParams<T>): void => {
    if (!params.isEditable || rowModesModel[params.id]?.mode === GridRowModes.Edit) {
      return;
    }

    const rowKey = String(params.id);
    if (!rowSnapshotRef.current.has(rowKey)) {
      const row = rowsById.get(rowKey);
      if (row) {
        rowSnapshotRef.current.set(rowKey, row as T);
      }
    }

    const api = gridApiRef.current;
    if (!api) {
      return;
    }

    api.setCellFocus(params.id, params.field);
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [params.id]: { mode: GridRowModes.Edit, fieldToFocus: params.field },
    }));
  }, [gridApiRef, rowModesModel, rowsById]);

  const getRowIdFromElement = (target: EventTarget | null): GridRowId | null => {
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
    return rowElement?.dataset.id ?? null;
  };

  const hasContextualRowActions = true;

  const {
    rowActionMenuState,
    longPressFeedbackRowId,
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
  } = useDataGridRowActionMenu({
    rowsById,
    hasContextualRowActions,
    markContextMenuHintUsed,
    setSelectedRowIds,
    getRowIdFromElement,
  });

  const clearRowInteractionState = useCallback((rowId: GridRowId): void => {
    const rowKey = String(rowId);
    setSelectedRowIds((currentSelectedIds) =>
      currentSelectedIds.filter((selectedId) => String(selectedId) !== rowKey),
    );
    setDirtyRowIds((previous) => {
      const next = new Set(previous);
      next.delete(rowKey);
      return next;
    });
    setActiveValidationErrors((previous) => {
      const next = { ...previous };
      delete next[rowKey];
      return next;
    });
    setRowModesModel((previousModel) => {
      const next = { ...previousModel };
      delete next[rowId];
      delete next[rowKey];
      return next;
    });
    rowSnapshotRef.current.delete(rowKey);
    clearRowActionMenuForId(rowId);
  }, [clearRowActionMenuForId]);

  const moveFocusAwayFromRemovedRow = useCallback((rowId: GridRowId, remainingRows: readonly T[]): void => {
    const rowKey = String(rowId);
    const api = gridApiRef.current as typeof gridApiRef.current & {
      state?: { focus?: { cell?: { id?: GridRowId } | null } };
    };
    const focusedCell = api?.state?.focus?.cell;
    if (focusedCell && String(focusedCell.id) !== rowKey) {
      return;
    }

    const focusField = columns.find((column) => column.editable !== false)?.field ?? columns[0]?.field;
    const fallbackRow = remainingRows.find((row) => String(row.id) !== rowKey);
    if (fallbackRow && focusField) {
      api?.setCellFocus(fallbackRow.id, focusField);
      return;
    }

    if (api?.state?.focus) {
      api.state.focus.cell = null;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [columns, gridApiRef]);

  const {
    pendingDeleteWithUndo,
    handleDeleteClick,
    deleteRowCommandRef,
    closeDeleteWithUndoSnackbar,
    undoDeleteWithUndo,
  } = useDataGridDelete<T>({
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
  });

  const handleDeleteSelectedRow = useCallback((): void => {
    const selectedRowId = selectedRowIds[0];
    if (!selectedRowId) {
      return;
    }

    handleDeleteClick(selectedRowId)();
  }, [handleDeleteClick, selectedRowIds]);

  const focusTable = useCallback((): void => {
    const api = gridApiRef.current;
    if (!api) return;
    const targetId = selectedRowIds[0] ?? api.getAllRowIds()[0];
    if (targetId == null) return;
    setSelectedRowIds([targetId]);
    const firstField = api.getVisibleColumns()
      .find((col) => col.field !== 'actions' && col.field !== 'rowEditActions')?.field;
    if (!firstField) return;
    requestAnimationFrame(() => {
      api.scrollToIndexes({
        rowIndex: api.getRowIndexRelativeToVisibleRows(targetId),
        colIndex: api.getColumnIndexRelativeToVisibleColumns(firstField),
      });
      api.setCellFocus(targetId, firstField);
    });
  }, [
    gridApiRef,
    selectedRowIds,
    setSelectedRowIds,
  ]);

  const handleStartRowEdit = useCallback((rowId: GridRowId, field?: string): void => {
    const rowKey = String(rowId);
    if (!rowSnapshotRef.current.has(rowKey)) {
      const row = rowsById.get(rowKey);
      if (row) {
        rowSnapshotRef.current.set(rowKey, row as T);
      }
    }

    const fieldToFocus = field ?? columns.find((column) => column.editable !== false)?.field ?? columns[0]?.field;
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [rowId]: { mode: GridRowModes.Edit, fieldToFocus },
    }));
  }, [columns, rowsById]);

  // Scrolls to and selects a specific row by id, optionally opening edit
  // mode on it — used by pages that deep-link into this grid (e.g.
  // "Anbauplan öffnen"/"bearbeiten" from the Gantt calendar's context menu)
  // instead of just prefilling a brand-new draft row via `initialRow`.
  const openRowById = useCallback((rowId: GridRowId, options?: { startEdit?: boolean }): void => {
    const api = gridApiRef.current;
    if (!api || !rowsById.has(String(rowId))) return;
    const shouldStartEdit = options?.startEdit !== false;
    setSelectedRowIds([rowId]);
    const firstField = api.getVisibleColumns()
      .find((col) => col.field !== 'actions' && col.field !== 'rowEditActions')?.field;
    requestAnimationFrame(() => {
      api.scrollToIndexes(firstField
        ? {
            rowIndex: api.getRowIndexRelativeToVisibleRows(rowId),
            colIndex: api.getColumnIndexRelativeToVisibleColumns(firstField),
          }
        : { rowIndex: api.getRowIndexRelativeToVisibleRows(rowId) });
      // Edit mode moves focus into its own input via `fieldToFocus` below;
      // only move keyboard focus here for the view-only (non-edit) case.
      if (!shouldStartEdit && firstField) {
        api.setCellFocus(rowId, firstField);
      }
    });
    if (shouldStartEdit) {
      handleStartRowEdit(rowId);
    }
  }, [gridApiRef, handleStartRowEdit, rowsById, setSelectedRowIds]);

  useDataGridCommandApi<T>({
    commandApiRef,
    selectedRowIds,
    deleteRowCommandRef,
    handleAddClick,
    handleEditSelectedRow,
    handleDeleteSelectedRow,
    setRowModesModel,
    applyDraftValues,
    commitDraftValues,
    reload: fetchData,
    focusTable,
    openRowById,
  });

  const handleDuplicateRow = useCallback((row: T): void => {
    if (!duplicateRow) {
      return;
    }

    const duplicatedRow = duplicateRow(row);
    setRows((previousRows) => [duplicatedRow, ...previousRows]);
    setStableRowOrder((previousOrder) => [duplicatedRow.id, ...previousOrder]);
    setDirtyRowIds((previous) => {
      const next = new Set(previous);
      next.add(String(duplicatedRow.id));
      return next;
    });
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [duplicatedRow.id]: { mode: GridRowModes.Edit, fieldToFocus: columns[0]?.field },
    }));
  }, [columns, duplicateRow]);

  const rowActionHelpers = useMemo<EditableDataGridRowActionHelpers<T>>(() => ({
    startEdit: handleStartRowEdit,
    duplicate: handleDuplicateRow,
    delete: (rowId: GridRowId) => handleDeleteClick(rowId)(),
  }), [handleDeleteClick, handleDuplicateRow, handleStartRowEdit]);

  const defaultRowActions = useCallback((row: T): EditableDataGridRowAction<T>[] => {
    const actions: EditableDataGridRowAction<T>[] = [];

    if (duplicateRow) {
      actions.push({
        id: 'duplicate',
        label: t('actions.duplicate'),
        icon: <ContentCopyIcon fontSize="small" />,
        onClick: (targetRow, helpers) => helpers.duplicate(targetRow),
      });
    }

    actions.push({
      id: 'delete',
      label: t('actions.delete'),
      icon: <DeleteIcon fontSize="small" />,
      color: 'error',
      onClick: (_row, helpers) => helpers.delete(row.id),
    });

    return actions;
  }, [duplicateRow, t]);

  const resolveRowActions = useCallback((row: T): EditableDataGridRowAction<T>[] => {
    return getRowActions ? getRowActions(row, rowActionHelpers) : defaultRowActions(row);
  }, [defaultRowActions, getRowActions, rowActionHelpers]);

  const menuRow = rowActionMenuState ? rowsById.get(String(rowActionMenuState.rowId)) as T | undefined : undefined;
  const shouldUseRowActions = Boolean(getRowActions || duplicateRow);
  const menuActions = menuRow && shouldUseRowActions ? resolveRowActions(menuRow) : [];
  const resolvedClipboardColumns = useMemo<EditableDataGridClipboardColumn<T>[]>(() => {
    if (clipboardColumns) {
      return clipboardColumns;
    }
    return columns
      .filter((column) => column.field !== 'id' && column.field !== 'actions' && column.type !== 'actions')
      .map((column) => ({
        field: column.field,
        headerName: column.headerName ?? column.field,
      }));
  }, [clipboardColumns, columns]);
  const getClipboardRowValues = useCallback((row: T): TableClipboardRow => (
    resolvedClipboardColumns.map((column) => (
      column.getValue
        ? column.getValue(row)
        : formatClipboardValue(row[column.field])
    ))
  ), [resolvedClipboardColumns]);
  const getClipboardTableRows = useCallback((): TableClipboardRow[] => [
    resolvedClipboardColumns.map((column) => column.headerName),
    ...(rowsForGrid as T[]).map(getClipboardRowValues),
  ], [getClipboardRowValues, resolvedClipboardColumns, rowsForGrid]);

  const renderInlineActionCell = useCallback((
    col: GridColDef,
    params: GridRenderCellParams<T>,
  ) => {
    const row = params.row as T;
    const actions = getInlineRowActions?.(row, rowActionHelpers) ?? [];
    const hasInlineMenuAction = showInlineRowActionMenu && row.id !== undefined;
    const baseContent: ReactNode = col.renderCell
      ? col.renderCell(params)
      : String(params.formattedValue ?? params.value ?? '');

    if (actions.length === 0 && !hasInlineMenuAction) {
      return baseContent;
    }

    return (
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'block',
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {baseContent}
        </Box>
        <Box
          className="ofp-inline-row-actions"
          sx={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            py: 0.25,
            pl: 0.25,
            pr: 0.25,
            borderRadius: 1,
            bgcolor: 'background.paper',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'background-color 120ms ease-in-out, opacity 120ms ease-in-out',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: '100%',
              width: 16,
              pointerEvents: 'none',
              background: (theme) =>
                `linear-gradient(90deg, ${alpha(theme.palette.background.paper, 0)} 0%, ${theme.palette.background.paper} 100%)`,
            },
            '.MuiDataGrid-row:hover &': {
              bgcolor: 'surface.surfaceHoverBackground',
              opacity: 1,
              pointerEvents: 'auto',
            },
            '.MuiDataGrid-row:hover &::before': {
              background: (theme) => {
                const hoverBackground = theme.palette.surface?.surfaceHoverBackground ?? theme.palette.action.hover;
                return `linear-gradient(90deg, ${alpha(hoverBackground, 0)} 0%, ${hoverBackground} 100%)`;
              },
            },
            '.MuiDataGrid-row--editing:hover &, .ofp-row-editing:hover &': {
              opacity: 0,
              pointerEvents: 'none',
            },
          }}
        >
          {actions.map((action) => (
            <Tooltip key={action.id} title={action.label} arrow>
              <span>
                <IconButton
                  size="small"
                  color={action.color ?? 'default'}
                  aria-label={action.label}
                  disabled={action.disabled}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    action.onClick(row, rowActionHelpers);
                  }}
                >
                  {action.icon}
                </IconButton>
              </span>
            </Tooltip>
          ))}
          {hasInlineMenuAction ? (
            <Tooltip title={t('actions.actions')} arrow>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('actions.actions')}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    openRowActionMenuAt(row.id, event.currentTarget, rect.right - 8, rect.top + 12);
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
        </Box>
      </Box>
    );
  }, [getInlineRowActions, openRowActionMenuAt, rowActionHelpers, showInlineRowActionMenu, t]);

  /**
   * Custom footer component with add button
   */
  const CustomFooter = () => {
    const hasInvalidCell = hasValidationError || hasInvalidRowInEditMode;

    return (
      <Box sx={dataGridFooterSx}>
        {showAddAction && (
          <IconButton
            onClick={handleAddClick}
            color="primary"
            size="small"
            aria-label={addButtonLabel}
          >
            <AddIcon />
          </IconButton>
        )}
        {showFooterEditControls && hasUnsavedChanges && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: showAddAction ? 1 : 0 }}>
            <Button size="small" variant="contained" onClick={() => void handleSaveAllDirtyRows()}>
              {t('actions.save')}
            </Button>
            <Button
              size="small"
              onClick={() => {
                const editIds = Object.entries(rowModesModel)
                  .filter(([, mode]) => mode.mode === GridRowModes.Edit)
                  .map(([id]) => id);
                for (const id of editIds) {
                  handleDiscardRowChanges(id);
                }
              }}
            >
              {t('actions.cancel')}
            </Button>
            {hasInvalidCell && <Chip size="small" color="error" label={t('messages.validationErrors')} />}
          </Box>
        )}
      </Box>
    );
  };

  /**
   * Process columns to replace notes fields with NotesCell renderer
   */
  const processedColumns: GridColDef[] = useMemo(() => {
    const prepareColumn = (col: GridColDef): GridColDef => {
      const preparedColumn = prepareDataGridColumn(col);
      if (preparedColumn.field !== inlineRowActionField || (!getInlineRowActions && !showInlineRowActionMenu)) {
        return preparedColumn;
      }

      return {
        ...preparedColumn,
        renderCell: (params) => renderInlineActionCell(preparedColumn, params as GridRenderCellParams<T>),
      };
    };

    if (!notes || !notes.fields || notes.fields.length === 0) {
      return columns.map((col) => prepareColumn(col));
    }

    return columns.map((col) => {
      if (!notesFieldNames.includes(col.field)) {
        return prepareColumn(col);
      }

      const fieldConfig = notes.fields.find((f) => f.field === col.field);

      return prepareColumn({
        ...col,
        editable: false,
        renderCell: (params) => {
          const value = (params.value as string) || '';
          const hasValue = value.trim().length > 0;
          const excerpt = hasValue ? getPlainExcerpt(value, 120) : '';

          const row = params.row as T;
          const attachmentCountRaw = fieldConfig?.attachmentCountField
            ? row[fieldConfig.attachmentCountField as keyof T]
            : 0;
          const attachmentCount = typeof attachmentCountRaw === 'number' ? attachmentCountRaw : 0;

          return (
            <NotesCell
              hasValue={hasValue}
              excerpt={excerpt}
              rawValue={value}
              attachmentCount={attachmentCount}
              compactIndicator={Boolean(fieldConfig?.compactIndicator)}
              onOpen={() => notesEditor.handleOpen(params.id, col.field)}
              onOpenAttachments={(event) => {
                event.preventDefault();
                event.stopPropagation();
                notesEditor.handleOpen(params.id, col.field, { focusAttachments: true });
              }}
              hasFocus={params.hasFocus}
            />
          );
        },
      });
    });
  }, [columns, getInlineRowActions, inlineRowActionField, notes, notesEditor, notesFieldNames, renderInlineActionCell, showInlineRowActionMenu]);

  const columnsWithActions: GridColDef[] = [
    ...processedColumns,
    ...(showRowEditActions
      ? [
          {
            field: 'rowEditActions',
            headerName: '',
            sortable: false,
            filterable: false,
            width: 128,
            align: 'right' as const,
            renderCell: (params: GridCellParams<T>) => {
              const rowId = params.id;
              const rowKey = String(rowId);
              const isEditing = rowModesModel[rowId]?.mode === GridRowModes.Edit;
              const hasLocalDraft = dirtyRowIds.has(rowKey);

              return (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, width: '100%', justifyContent: 'flex-end' }}>
                  {(isEditing || hasLocalDraft) && (
                    <>
                      <Tooltip title={t('actions.saveRow')} arrow>
                        <IconButton size="small" color="primary" aria-label={t('actions.save')} onClick={() => void handleSaveRow(rowId)}>
                          <CheckIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('actions.cancelRowEdit')} arrow>
                        <IconButton size="small" aria-label={t('actions.cancel')} onClick={() => handleDiscardRowChanges(rowId)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip title={t('actions.deleteRow')} arrow>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={t('actions.delete')}
                      onClick={() => handleDeleteClick(rowId)()}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            },
          },
        ]
      : []),
    ...(!showRowEditActions && showDeleteAction
      ? [
          {
            field: 'actions',
            type: 'actions' as const,
            headerName: '',
            width: 70,
            cellClassName: 'actions',
            getActions: ({ id }: GridRowParams<T>) => {
              return [
                <IconButton
                  key={`delete-${id}`}
                  onClick={handleDeleteClick(id)}
                  size="small"
                  sx={deleteIconButtonSx}
                  aria-label={t('actions.delete')}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>,
              ];
            },
          },
        ]
      : []),
  ];

  const handleViewModeCellNavigation = useCallback((params: GridCellParams<T>, event: DataGridKeyboardEvent): boolean => {
    if (
      rowModesModel[params.id]?.mode === GridRowModes.Edit ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return false;
    }

    const direction = event.shiftKey ? -1 : 1;
    const target =
      event.key === 'Tab'
        ? getKeyboardNavigationTarget<T>({
          api: gridApiRef.current,
          columns: columnsWithActions,
          current: { id: params.id, field: params.field },
          direction,
          isActionCell: isActionCellKeyboardNavigable,
          rows: rowsForGrid,
          wrapRows: true,
        })
        : event.key === 'ArrowRight'
          ? getKeyboardNavigationTarget<T>({
            api: gridApiRef.current,
            columns: columnsWithActions,
            current: { id: params.id, field: params.field },
            direction: 1,
            isActionCell: isActionCellKeyboardNavigable,
            rows: rowsForGrid,
          })
          : event.key === 'ArrowLeft'
            ? getKeyboardNavigationTarget<T>({
              api: gridApiRef.current,
              columns: columnsWithActions,
              current: { id: params.id, field: params.field },
              direction: -1,
              isActionCell: isActionCellKeyboardNavigable,
              rows: rowsForGrid,
            })
            : event.key === 'ArrowDown'
              ? getVerticalKeyboardNavigationTarget<T>({
                api: gridApiRef.current,
                columns: columnsWithActions,
                current: { id: params.id, field: params.field },
                direction: 1,
                isActionCell: isActionCellKeyboardNavigable,
                rows: rowsForGrid,
              })
              : event.key === 'ArrowUp'
                ? getVerticalKeyboardNavigationTarget<T>({
                  api: gridApiRef.current,
                  columns: columnsWithActions,
                  current: { id: params.id, field: params.field },
                  direction: -1,
                  isActionCell: isActionCellKeyboardNavigable,
                  rows: rowsForGrid,
                })
                : null;

    if (!target) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    event.defaultMuiPrevented = true;
    focusDataGridKeyboardNavigableCell<T>({
      api: gridApiRef.current,
      cell: target,
    });
    return true;
  }, [
    columnsWithActions,
    gridApiRef,
    isActionCellKeyboardNavigable,
    rowModesModel,
    rowsForGrid,
  ]);

  const getNotesDrawerTitle = (): string => {
    if (!notesEditor.field || !notes) return 'Notizen';
    
    const config = notes.fields.find(f => f.field === notesEditor.field);
    if (!config) return 'Notizen';
    
    // Use titleKey if provided
    if (config.titleKey) {
      return t(config.titleKey);
    }
    
    // Use labelKey if provided
    if (config.labelKey) {
      const fieldLabel = t(config.labelKey);
      return `${fieldLabel} – Notizen`;
    }
    
    // Fallback to field name from translations
    const fieldLabel = t(`fields.${notesEditor.field}`);
    if (fieldLabel !== `fields.${notesEditor.field}`) {
      return `${fieldLabel} – Notizen`;
    }
    
    // Last resort: use field name itself
    return `${notesEditor.field} – Notizen`;
  };

  useEffect(() => {
    if (!onRowsStateChange) {
      return;
    }
    onRowsStateChange(rows as T[]);
  }, [onRowsStateChange, rows]);

  useEffect(() => {
    if (!onLoadStateChange) {
      return;
    }
    onLoadStateChange({ loading, dataFetched, error });
  }, [dataFetched, error, loading, onLoadStateChange]);

  useEffect(() => {
    if (!onSelectedRowChange) {
      return;
    }

    const selectedId = selectedRowIds[0];
    const selectedRow = rows.find((row) => row.id === selectedId) as T | undefined;
    onSelectedRowChange(selectedRow ?? null);
  }, [onSelectedRowChange, selectedRowIds, rows]);

  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {showContextMenuHint ? (
        <ContextMenuHint
          message={t('messages.contextMenuTableHint')}
          onClose={closeContextMenuHint}
          sx={{ mb: 1.25 }}
        />
      ) : null}
      
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflow: 'visible',
        }}
      >
        <Box
          onKeyDownCapture={handleGridEditNavigation}
          sx={{
            minWidth: 0,
            maxWidth: '100%',
            overflowX: 'auto',
            overflowY: 'visible',
            display: 'flex',
            justifyContent: shouldUseCompactContainer || isContentSizedSurface ? 'center' : 'flex-start',
          }}
        >
          <Box
            ref={gridSurfaceRef}
            onContextMenu={hasContextualRowActions ? (event) => {
              if (!isRowActionContextMenuTarget(event.target)) {
                return;
              }
              const rowId = getRowIdFromElement(event.target);
              if (rowId === null) {
                return;
              }
              openRowActionContextMenu(rowId, event);
            } : undefined}
            onTouchStart={hasContextualRowActions ? handleGridTouchStart : undefined}
            onTouchMove={hasContextualRowActions ? handleGridTouchMove : undefined}
            onTouchEnd={hasContextualRowActions ? handleGridTouchEnd : undefined}
            onTouchCancel={hasContextualRowActions ? handleGridTouchEnd : undefined}
            onMouseDownCapture={handleReadOnlyCellMouseDown}
            sx={{
              position: 'relative',
              display: 'block',
              width: isContentSizedSurface ? 'fit-content' : '100%',
              minWidth: isContentSizedSurface ? 0 : '100%',
              maxWidth: '100%',
              '& [role="row"][data-id]': {
                WebkitTouchCallout: 'none',
              },
            }}
          >
            <DataGrid
          rows={rowsForGrid}
          columns={columnsWithActions}
          rowModesModel={rowModesModel}
          onRowModesModelChange={setRowModesModel}
          onRowEditStop={(params, event, details) => {
            if (params.reason === GridRowEditStopReasons.escapeKeyDown) {
              handleDiscardRowChanges(params.id);
            }
            handleRowEditStop(params, event, details);
          }}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={handleProcessRowUpdateError}
          loading={loading}
          editMode="row"
          density={isMobile ? 'standard' : 'compact'}
          autoHeight
          hideFooter={false}
          pagination={paginationPageSizeOptions ? true : undefined}
          paginationModel={paginationPageSizeOptions ? paginationModel : undefined}
          onPaginationModelChange={paginationPageSizeOptions ? setPaginationModel : undefined}
          pageSizeOptions={paginationPageSizeOptions}
          sortModel={sortModel}
          onSortModelChange={handleSortModelChange}
          sortingMode="server"
          filterModel={filterModel}
          onFilterModelChange={handleFilterModelChange}
          rowSelectionModel={{ type: "include", ids: new Set(selectedRowIds) }}
          onRowSelectionModelChange={(nextModel) => setSelectedRowIds(Array.from(nextModel.ids))}
          slots={{
            footer: CustomFooter,
          }}
          sx={{
            ...dataGridSx,
            width: isContentSizedSurface ? 'fit-content' : '100%',
            minWidth: isContentSizedSurface ? 0 : '100%',
            display: isContentSizedSurface ? 'inline-block' : 'block',
            '& .MuiDataGrid-row.ofp-row-long-press .MuiDataGrid-cell': {
              bgcolor: 'action.selected',
            },
            ...(shouldDisableTrailingFiller ? {
              '& .MuiDataGrid-filler': { display: 'none' },
              '& .MuiDataGrid-scrollbarFiller': { display: 'none' },
              '& .MuiDataGrid-main': { width: 'fit-content' },
              '& .MuiDataGrid-virtualScrollerContent': { width: 'fit-content !important' },
              '& .MuiDataGrid-columnHeaders': { width: 'fit-content !important' },
            } : {}),
          }}
          getRowClassName={(params) => {
            const rowKey = String(params.id);
            const classNames: string[] = [];
            if (rowModesModel[params.id]?.mode === GridRowModes.Edit) {
              classNames.push('ofp-row-editing');
            }
            if (dirtyRowIds.has(rowKey)) {
              classNames.push('ofp-row-dirty');
            }
            if (longPressFeedbackRowId !== null && String(longPressFeedbackRowId) === rowKey) {
              classNames.push('ofp-row-long-press');
            }
            return classNames.join(' ');
          }}
          getCellClassName={(params) => {
            const rowKey = String(params.id);
            const errorText = activeValidationErrors[rowKey]?.[params.field] ?? rowValidationErrors[rowKey]?.[params.field];
            if (errorText) {
              return 'ofp-cell-error';
            }
            if (dirtyRowIds.has(rowKey)) {
              return 'ofp-cell-dirty';
            }
            return '';
          }}
          onCellClick={(params, event) => {
            if (!isCellKeyboardNavigable<T>({
              api: gridApiRef.current,
              field: params.field,
              isActionCell: isActionCellKeyboardNavigable,
              rowId: params.id,
            })) {
              event.preventDefault();
              event.stopPropagation();
              event.defaultMuiPrevented = true;
              return;
            }

            const rowKey = String(params.id);
            if (!rowSnapshotRef.current.has(rowKey)) {
              const row = rowsById.get(rowKey);
              if (row) {
                rowSnapshotRef.current.set(rowKey, row as T);
              }
            }
            markRowDirty(rowKey);
            handleEditableCellClick(params, rowModesModel, setRowModesModel);
          }}
          onCellKeyDown={(params: GridCellParams<T>, event) => {
            if (
              hasContextualRowActions &&
              (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) &&
              rowsById.has(String(params.id))
            ) {
              event.preventDefault();
              event.stopPropagation();
              event.defaultMuiPrevented = true;
              openRowActionKeyboardContextMenu(params.id, event.currentTarget as HTMLElement);
              return;
            }

            if (
              event.key === 'Tab' ||
              event.key === 'ArrowLeft' ||
              event.key === 'ArrowRight' ||
              event.key === 'ArrowUp' ||
              event.key === 'ArrowDown'
            ) {
              const didNavigate = handleViewModeCellNavigation(params, event as unknown as DataGridKeyboardEvent);
              if (didNavigate) {
                return;
              }
            }

            const shouldOpenNotes =
              notesFieldNames.includes(params.field) &&
              (event.key === 'Enter' || event.key === ' ') &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey;

            if (shouldOpenNotes) {
              event.preventDefault();
              event.defaultMuiPrevented = true;
              notesEditor.handleOpen(params.id, params.field);
              return;
            }

            const shouldStartCellEdit =
              event.key === 'Enter' &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey &&
              !event.shiftKey &&
              params.isEditable &&
              rowModesModel[params.id]?.mode !== GridRowModes.Edit;

            if (shouldStartCellEdit) {
              event.preventDefault();
              event.defaultMuiPrevented = true;
              handleStartCellEditFromKeyboard(params);
              return;
            }
            if (
              rowModesModel[params.id]?.mode === GridRowModes.Edit &&
              editModeEditorArrowKeys.has(event.key) &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              event.defaultMuiPrevented = true;
              return;
            }
            const shouldHandleEnterInEditedRow =
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey &&
              rowModesModel[params.id]?.mode === GridRowModes.Edit;
            if (shouldHandleEnterInEditedRow) {
              event.defaultMuiPrevented = true;
              if (isEnterSaveInputTarget(event.target)) {
                event.preventDefault();
                void handleSaveRow(params.id);
              }
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.defaultMuiPrevented = true;
              handleDiscardRowChanges(params.id);
              return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
              event.preventDefault();
              void handleSaveRow(params.id);
            }
          }}
          localeText={germanDataGridLocaleText}
          apiRef={gridApiRef}
          />
          </Box>
        </Box>
      </Box>
      <Menu
        open={Boolean(rowActionMenuState)}
        onClose={closeRowActionMenu}
        hideBackdrop
        sx={{ pointerEvents: 'none' }}
        autoFocus
        disableAutoFocusItem={false}
        slotProps={{
          paper: {
            className: 'ofp-custom-context-menu',
            sx: { pointerEvents: 'auto' },
          },
          list: {
            autoFocus: true,
            ref: rowActionMenuListRef,
            onKeyDown: (event: KeyboardEvent<HTMLUListElement>) => handleContextMenuKeyboardNavigation(event, closeRowActionMenu),
          },
        }}
        onKeyDown={(event) => handleContextMenuKeyboardNavigation(event, closeRowActionMenu)}
        anchorEl={rowActionMenuState?.anchorEl}
        anchorReference={(rowActionMenuState?.anchorEl ? 'anchorEl' : 'anchorPosition') as 'anchorEl' | 'anchorPosition'}
        anchorPosition={
          rowActionMenuState?.mouseX !== undefined && rowActionMenuState?.mouseY !== undefined
            ? { left: rowActionMenuState.mouseX, top: rowActionMenuState.mouseY }
            : undefined
        }
      >
        {menuActions.map((action) => (
          <MenuItem
            key={action.id}
            disabled={action.disabled}
            onClick={() => {
              if (!menuRow) {
                return;
              }
              closeRowActionMenu();
              action.onClick(menuRow, rowActionHelpers);
            }}
          >
            {action.icon ? (
              <ListItemIcon sx={{ color: action.color === 'error' ? 'error.main' : undefined }}>
                {action.icon}
              </ListItemIcon>
            ) : null}
            <ListItemText
              primary={action.label}
              primaryTypographyProps={{
                color: action.color === 'error' ? 'error.main' : 'text.primary',
              }}
            />
          </MenuItem>
        ))}
        <TableCopyMenuItems
          rowValues={menuRow ? getClipboardRowValues(menuRow) : null}
          tableRows={getClipboardTableRows()}
          copyRowLabel={t('actions.copyRow')}
          copyTableLabel={t('actions.copyTable')}
          rowCopiedMessage={t('messages.rowCopied')}
          tableCopiedMessage={t('messages.tableCopied')}
          copyErrorMessage={t('messages.copyError')}
          includeDivider={menuActions.length > 0}
          onClose={closeRowActionMenu}
        />
      </Menu>

      {deleteUndoOptions ? pendingDeleteWithUndo.map((deletion, index) => (
        <DeleteUndoSnackbar
          key={deletion.id}
          open={deletion.visible}
          message={deleteUndoOptions.message}
          undoLabel={t('actions.undo')}
          offsetIndex={index}
          testId={deleteUndoOptions.snackbarTestId ?? 'data-grid-delete-snackbar'}
          onClose={() => closeDeleteWithUndoSnackbar(deletion.id)}
          onUndo={() => undoDeleteWithUndo(deletion.id)}
        />
      )) : null}

      {/* Notes Editor Drawer */}
      {notes && notes.fields && notes.fields.length > 0 && (
        <NotesDrawer
          open={notesEditor.isOpen}
          title={getNotesDrawerTitle()}
          value={notesEditor.draft}
          onChange={notesEditor.setDraft}
          onSave={notesEditor.handleSave}
          onClose={notesEditor.handleClose}
          hasUnsavedChanges={Boolean(
            notesEditor.currentRow &&
              notesEditor.field &&
              notesEditor.draft !== ((notesEditor.currentRow[notesEditor.field] as string) || ''),
          )}
          loading={notesEditor.isSaving}
          focusAttachments={notesEditor.focusAttachments}
          focusRequestId={notesEditor.focusRequestId}
          noteId={(() => {
            if (!notesEditor.currentRow || !notesEditor.field || !notes) return undefined;
            const cfg = notes.fields.find((f) => f.field === notesEditor.field);
            if (!cfg?.attachmentNoteIdField) return undefined;
            const val = notesEditor.currentRow[cfg.attachmentNoteIdField as keyof typeof notesEditor.currentRow];
            return typeof val === "number" ? val : undefined;
          })()}
        />
      )}
    </>
  );
}
