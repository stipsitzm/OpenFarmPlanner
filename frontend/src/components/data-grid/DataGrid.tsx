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

import { useState, useEffect, useCallback, useRef, useMemo, type KeyboardEvent, type MutableRefObject, type TouchEvent } from 'react';
import {
  DataGrid,
  GridRowModes,
  getGridBooleanOperators,
  getGridDateOperators,
  getGridNumericOperators,
  getGridSingleSelectOperators,
  getGridStringOperators,
  useGridApiRef,
} from '@mui/x-data-grid';
import { dataGridSx, dataGridFooterSx, deleteIconButtonSx } from './styles';
import { handleRowEditStop, handleEditableCellClick } from './handlers';
import type { GridColDef, GridRowsProp, GridRowModesModel, GridRowId, GridSortModel, GridFilterModel, GridCellParams, GridRowParams, GridFilterOperator } from '@mui/x-data-grid';
import { Box, Alert, IconButton, Chip, Button, Tooltip, useMediaQuery, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useNavigationBlocker } from '../../hooks/autosave';
import { usePersistentSortModel } from '../../hooks/usePersistentSortModel';
import { confirmAction } from '../../utils/confirmAction';
import { useTranslation } from '../../i18n';
import { NotesCell } from './NotesCell';
import { NotesDrawer } from './NotesDrawer';
import {
  DeleteUndoSnackbar,
  DELETE_UNDO_DURATION_MS,
} from './DeleteUndoSnackbar';
import { getPlainExcerpt } from './markdown';
import { useNotesEditor } from './useNotesEditor';
import { extractApiErrorMessage } from '../../api/errors';
import { germanDataGridLocaleText } from './localeText';
import { TableCopyMenuItems } from './TableCopyMenuItems';
import { formatClipboardValue, type TableClipboardRow } from './tableClipboard';

export interface EditableRow {
  id: number;
  isNew?: boolean;
  __draft?: boolean;
  [key: string]: unknown;
}

export interface DataGridAPI<T> {
  list: () => Promise<{ data: { results: Partial<T>[] } }>;
  create: (data: Partial<T>) => Promise<{ data: T }>;
  update: (id: number, data: Partial<T>) => Promise<{ data: T }>;
  delete: (id: number) => Promise<void>;
}


export interface EditableDataGridCommandApi {
  addRow: () => void;
  editSelectedRow: () => void;
  deleteSelectedRow: () => void;
  getSelectedRowId: () => GridRowId | null;
  setDraftValues: (rowId: GridRowId, values: Partial<EditableRow>) => Promise<void>;
  reload: () => Promise<void>;
}

export interface EditableDataGridRowActionHelpers<T extends EditableRow> {
  startEdit: (rowId: GridRowId, field?: string) => void;
  duplicate: (row: T) => void;
  delete: (rowId: GridRowId) => void;
}

export interface EditableDataGridRowAction<T extends EditableRow> {
  id: string;
  label: string;
  icon?: React.ReactElement;
  color?: 'default' | 'error' | 'primary';
  onClick: (row: T, helpers: EditableDataGridRowActionHelpers<T>) => void;
  disabled?: boolean;
}

interface DeleteUndoOptions {
  message: string;
  snackbarTestId?: string;
}

export interface EditableDataGridClipboardColumn<T extends EditableRow> {
  field: string;
  headerName: string;
  getValue?: (row: T) => string;
}

interface PendingDeleteWithUndo<T extends EditableRow> {
  id: string;
  rowId: GridRowId;
  row: T;
  rowsBeforeDelete: T[];
  stableRowOrderBeforeDelete: GridRowId[];
  rowModeBeforeDelete?: GridRowModesModel[string];
  visible: boolean;
}

export interface NotesFieldConfig {
  field: string;
  labelKey?: string;
  titleKey?: string;
  attachmentNoteIdField?: string;
  attachmentCountField?: string;
  compactIndicator?: boolean;
}

export interface EditableDataGridProps<T extends EditableRow> {
  columns: GridColDef[]; // Column definitions for the grid (without actions column)
  api: DataGridAPI<T>; // API handler for CRUD operations
  createNewRow: () => T; // Function to create a new empty row
  mapToRow: (item: T) => T; // Function to map API data to grid row
  mapToApiData: (row: T) => Partial<T> | Promise<Partial<T>>; // Function to map grid row to API data for create/update
  validateRow: (row: T) => string | null; // Function to validate row before save
  loadErrorMessage: string; // Error message when loading fails
  saveErrorMessage: string; // Error message when save fails
  deleteErrorMessage: string; // Error message when delete fails
  deleteConfirmMessage: string; // Delete confirmation message
  addButtonLabel: string; // Aria label for add button
  showDeleteAction?: boolean; // Whether to show delete action column (default: true)
  initialRow?: Partial<T>; // Optional initial row to add on mount (e.g., pre-filled from another page)
  tableKey?: string; // Optional key for persisting table sorting in session + URL
  defaultSortModel?: GridSortModel; // Optional default sort model (used when no persisted state exists)
  persistSortInUrl?: boolean; // Whether sorting should be persisted in URL query params
  notes?: {
    fields: NotesFieldConfig[];
  };
  commandApiRef?: MutableRefObject<EditableDataGridCommandApi | null>;
  onSelectedRowChange?: (row: T | null) => void;
  getRowValidationErrors?: (row: T) => Record<string, string>;
  showAddAction?: boolean;
  showFooterEditControls?: boolean;
  showRowEditActions?: boolean;
  getRowActions?: (row: T, helpers: EditableDataGridRowActionHelpers<T>) => EditableDataGridRowAction<T>[];
  duplicateRow?: (row: T) => T;
  deleteUndoOptions?: DeleteUndoOptions;
  clipboardColumns?: EditableDataGridClipboardColumn<T>[];
  onRowsStateChange?: (rows: T[]) => void;
  onLoadStateChange?: (state: { loading: boolean; dataFetched: boolean; error: string }) => void;
  onBeforeSaveRow?: (row: T) => boolean | Partial<T> | Promise<boolean | Partial<T>>;
  isSaveErrorHandled?: (error: unknown) => boolean;
  /**
   * Controls how the grid surface uses available page/workspace width:
   * - contentFit: fit to content and center, but never exceed container width
   * - fullWorkspace: fill available workspace width
   * - compact: compact content-sized mode for small tables
   */
  surfaceSizing?: 'contentFit' | 'fullWorkspace' | 'compact';
}

const isUnsavedDraftRow = (row: EditableRow): boolean =>
  Boolean(row.isNew || row.__draft || Number(row.id) < 0);

const ROW_ACTION_LONG_PRESS_MS = 550;

class SaveBlockedError extends Error {
  constructor() {
    super('Save blocked by validation');
    this.name = 'SaveBlockedError';
  }
}

const isSaveBlockedError = (error: unknown): error is SaveBlockedError =>
  error instanceof SaveBlockedError;

const getDefaultFilterOperators = (column: GridColDef): GridFilterOperator[] => {
  switch (column.type) {
    case 'boolean':
      return getGridBooleanOperators();
    case 'date':
      return getGridDateOperators();
    case 'dateTime':
      return getGridDateOperators(true);
    case 'number':
      return getGridNumericOperators();
    case 'singleSelect':
      return getGridSingleSelectOperators();
    default:
      return getGridStringOperators();
  }
};

const keepDraftRowsVisibleForFilterOperators = (operators: readonly GridFilterOperator[]): GridFilterOperator[] =>
  operators.map((operator) => ({
    ...operator,
    getApplyFilterFn: (filterItem, column) => {
      const applyFilter = operator.getApplyFilterFn(filterItem, column);
      if (!applyFilter) {
        return null;
      }

      return (value, row, filterColumn, apiRef) => {
        if (isUnsavedDraftRow(row as EditableRow)) {
          return true;
        }

        return applyFilter(value, row, filterColumn, apiRef);
      };
    },
  }));

const keepDraftRowsVisibleForColumnFilters = (column: GridColDef): GridColDef => {
  if (column.filterable === false) {
    return column;
  }

  return {
    ...column,
    filterOperators: keepDraftRowsVisibleForFilterOperators(
      column.filterOperators ?? getDefaultFilterOperators(column),
    ),
  };
};

const editModeEditorArrowKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

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

const getSortableValue = (row: EditableRow, field: string): unknown => row[field];

const compareSortableValues = (leftValue: unknown, rightValue: unknown): number => {
  if (leftValue === rightValue) {
    return 0;
  }
  if (leftValue === null || leftValue === undefined || leftValue === '') {
    return 1;
  }
  if (rightValue === null || rightValue === undefined || rightValue === '') {
    return -1;
  }
  if (leftValue instanceof Date || rightValue instanceof Date) {
    const leftTime = leftValue instanceof Date ? leftValue.getTime() : new Date(String(leftValue)).getTime();
    const rightTime = rightValue instanceof Date ? rightValue.getTime() : new Date(String(rightValue)).getTime();
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
      return leftTime - rightTime;
    }
  }
  if (typeof leftValue === 'number' && typeof rightValue === 'number') {
    return leftValue - rightValue;
  }
  if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') {
    return Number(leftValue) - Number(rightValue);
  }
  return String(leftValue).localeCompare(String(rightValue), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
};

const getSortedRowIds = <T extends EditableRow>(sourceRows: readonly T[], model: GridSortModel): GridRowId[] => {
  const [sortItem] = model;
  if (!sortItem?.field || !sortItem.sort) {
    return sourceRows.map((row) => row.id);
  }

  const direction = sortItem.sort === 'desc' ? -1 : 1;
  return sourceRows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const comparison = compareSortableValues(
        getSortableValue(left.row, sortItem.field),
        getSortableValue(right.row, sortItem.field),
      );
      return comparison === 0 ? left.index - right.index : comparison * direction;
    })
    .map(({ row }) => row.id);
};

const orderRowsByStableIds = <T extends EditableRow>(sourceRows: readonly T[], orderedIds: readonly GridRowId[]): T[] => {
  if (orderedIds.length === 0) {
    return [...sourceRows];
  }

  const rowsById = new Map(sourceRows.map((row) => [String(row.id), row]));
  const orderedRows = orderedIds
    .map((rowId) => rowsById.get(String(rowId)))
    .filter((row): row is T => row !== undefined);
  const orderedIdKeys = new Set(orderedIds.map(String));
  const missingRows = sourceRows.filter((row) => !orderedIdKeys.has(String(row.id)));
  return [...orderedRows, ...missingRows];
};

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
  duplicateRow,
  deleteUndoOptions,
  clipboardColumns,
  onRowsStateChange,
  onLoadStateChange,
  onBeforeSaveRow,
  isSaveErrorHandled,
  surfaceSizing,
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
  const initialRowProcessedRef = useRef<boolean>(false);
  const initialFetchDoneRef = useRef<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<GridRowId[]>([]);
  const [dirtyRowIds, setDirtyRowIds] = useState<Set<string>>(new Set());
  const [activeValidationErrors, setActiveValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const [longPressFeedbackRowId, setLongPressFeedbackRowId] = useState<GridRowId | null>(null);
  const [rowActionMenuState, setRowActionMenuState] = useState<{
    rowId: GridRowId;
    anchorEl?: HTMLElement;
    mouseX?: number;
    mouseY?: number;
  } | null>(null);
  const [pendingDeleteWithUndo, setPendingDeleteWithUndo] = useState<PendingDeleteWithUndo<T>[]>([]);
  const pendingDeleteTimersRef = useRef<Map<string, number>>(new Map());
  const rowActionLongPressTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const rowSnapshotRef = useRef<Map<string, T>>(new Map());
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

  const getKeyboardNavigableFieldsForRow = useCallback((rowId: GridRowId): string[] => {
    const api = gridApiRef.current;
    if (!api) {
      return [];
    }
    return api.getVisibleColumns()
      .filter((column) => {
        if (notesFieldNames.includes(column.field)) {
          return true;
        }

        if (!column.editable) {
          return false;
        }

        try {
          return api.isCellEditable(api.getCellParams(rowId, column.field));
        } catch {
          return false;
        }
      })
      .map((column) => column.field);
  }, [gridApiRef, notesFieldNames]);

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

    setRowModesModel((oldModel) => ({
      ...oldModel,
      [rowId]: { mode: GridRowModes.Edit, fieldToFocus: field },
    }));
  }, [gridApiRef, notesFieldNames, rowsById]);

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
    false,
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
      setRows((oldRows) => [newRow, ...oldRows]);
      setStableRowOrder((previousOrder) => [newRow.id, ...previousOrder]);
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
  const handleAddClick = (): void => {
    const newRow = createNewRow();
    setRows((oldRows) => [newRow, ...oldRows]);
    setStableRowOrder((previousOrder) => [newRow.id, ...previousOrder]);
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [newRow.id]: { mode: GridRowModes.Edit, fieldToFocus: columns[0]?.field },
    }));
  };

  const handleDiscardRowChanges = useCallback((rowId: GridRowId): void => {
    const rowKey = String(rowId);
    const snapshot = rowSnapshotRef.current.get(rowKey);
    if (snapshot) {
      setRows((prevRows) => prevRows.map((row) => (String(row.id) === rowKey ? snapshot : row)));
    } else if (Number(rowId) < 0) {
      setRows((prevRows) => prevRows.filter((row) => String(row.id) !== rowKey));
      setStableRowOrder((previousOrder) => previousOrder.filter((orderedId) => String(orderedId) !== rowKey));
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
    const targetRow = rowsById.get(rowKey);
    const api = gridApiRef.current;
    if (api) {
      const editUpdates = Object.entries(values).flatMap(([fieldKey, fieldValue]) => {
        if (fieldValue === undefined) {
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
    setDirtyRowIds((previous) => {
      const next = new Set(previous);
      next.add(rowKey);
      return next;
    });
  }, [getRowValidationErrors, gridApiRef, rowsById]);

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

  const shouldSaveRow = useCallback(async (rowId: GridRowId): Promise<boolean> => {
    const draftRow = getDraftRow(rowId);
    if (!draftRow) {
      return true;
    }
    const gatedRow = await runBeforeSaveGate(draftRow);
    if (!gatedRow) {
      return false;
    }
    if (gatedRow !== draftRow) {
      await applyDraftValues(rowId, gatedRow);
    }
    return true;
  }, [applyDraftValues, getDraftRow, runBeforeSaveGate]);

  const commitEditedRowDraftForKeyboardNavigation = useCallback((rowId: GridRowId): boolean => {
    const draftRow = getDraftRow(rowId);
    if (!draftRow) {
      return true;
    }

    const rowKey = String(rowId);
    setError('');
    setRows((prevRows) =>
      prevRows.map((row) => (String(row.id) === rowKey ? draftRow : row)),
    );
    setDirtyRowIds((prev) => {
      const next = new Set(prev);
      next.add(rowKey);
      return next;
    });
    return true;
  }, [getDraftRow]);

  const navigateFromEditedCell = useCallback((
    current: { id: GridRowId; field: string },
    target: { id: GridRowId; field: string },
    options: { startTargetEdit: boolean },
  ): void => {
    if (current.id === target.id && current.field === target.field) {
      return;
    }

    const canCommitCurrentDraft = commitEditedRowDraftForKeyboardNavigation(current.id);
    if (!canCommitCurrentDraft) {
      return;
    }

    const isSameRow = String(current.id) === String(target.id);

    if (isSameRow) {
      requestAnimationFrame(() => {
        focusKeyboardNavigableCell(target.id, target.field, {
          startEdit: options.startTargetEdit,
        });
      });
      return;
    }

    if (rowModesModel[current.id]?.mode === GridRowModes.Edit) {
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [current.id]: { mode: GridRowModes.View, ignoreModifications: true },
      }));
    }

    requestAnimationFrame(() => {
      focusKeyboardNavigableCell(target.id, target.field, { startEdit: options.startTargetEdit });
    });
  }, [
    commitEditedRowDraftForKeyboardNavigation,
    focusKeyboardNavigableCell,
    rowModesModel,
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

    const target = getHorizontalNavigationTarget(focusedCell.id, focusedCell.field, event.shiftKey ? -1 : 1);

    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    navigateFromEditedCell(focusedCell, target, {
      startTargetEdit: !notesFieldNames.includes(target.field),
    });
  }, [
    getFocusedCellFromEvent,
    getHorizontalNavigationTarget,
    navigateFromEditedCell,
    notesFieldNames,
    rowModesModel,
  ]);

  const processRowUpdate = useCallback(async (newRow: T): Promise<T> => {
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

    // Validate required fields
    const validationError = validateRow(rowAfterSaveGate);
    const rowKey = String(rowAfterSaveGate.id);
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
        setDirtyRowIds((prev) => {
          const next = new Set(prev);
          next.delete(rowKey);
          return next;
        });

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
        setDirtyRowIds((prev) => {
          const next = new Set(prev);
          next.delete(rowKey);
          return next;
        });
        return mappedRow;
      }
    } catch (err) {
      if (isSaveErrorHandled?.(err)) {
        console.error('Error saving data:', err);
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
    getRowValidationErrors,
    isSaveErrorHandled,
    mapToApiData,
    mapToRow,
    runBeforeSaveGate,
    saveErrorMessage,
    t,
    validateRow,
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

  const handleSaveRow = useCallback(async (rowId: GridRowId): Promise<void> => {
    if (!(await shouldSaveRow(rowId))) {
      return;
    }

    if (rowModesModel[rowId]?.mode === GridRowModes.Edit) {
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [rowId]: { mode: GridRowModes.View },
      }));
      return;
    }

    const row = rowsById.get(String(rowId)) as T | undefined;
    if (!row) {
      return;
    }

    try {
      const savedRow = await processRowUpdate(row);
      setRows((prevRows) =>
        prevRows.map((currentRow) =>
          String(currentRow.id) === String(rowId) ? savedRow : currentRow,
        ),
      );
    } catch (error) {
      handleProcessRowUpdateError(error);
    }
  }, [
    handleProcessRowUpdateError,
    processRowUpdate,
    rowModesModel,
    rowsById,
    shouldSaveRow,
  ]);

  const handleSaveAllDirtyRows = useCallback(async (): Promise<void> => {
    const editingRowIds = Object.entries(rowModesModel)
      .filter(([, mode]) => mode.mode === GridRowModes.Edit)
      .map(([id]) => id);
    const saveableRowIds: GridRowId[] = [];
    for (const rowId of editingRowIds) {
      if (await shouldSaveRow(rowId)) {
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
  }, [dirtyRowIds, handleSaveRow, rowModesModel, shouldSaveRow]);

  const handleEditSelectedRow = (): void => {
    const selectedRowId = selectedRowIds[0];
    if (!selectedRowId) {
      return;
    }

    setRowModesModel((oldModel) => ({
      ...oldModel,
      [selectedRowId]: { mode: GridRowModes.Edit, fieldToFocus: columns[0]?.field },
    }));
  };

  const handleDeleteSelectedRow = (): void => {
    const selectedRowId = selectedRowIds[0];
    if (!selectedRowId) {
      return;
    }

    handleDeleteClick(selectedRowId)();
  };

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

  const removePendingDeleteWithUndo = useCallback((deletionId: string): void => {
    setPendingDeleteWithUndo((currentDeletions) =>
      currentDeletions.filter((deletion) => deletion.id !== deletionId),
    );
  }, []);

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
    setLongPressFeedbackRowId((currentRowId) => (String(currentRowId) === rowKey ? null : currentRowId));
    setRowActionMenuState((currentState) =>
      currentState && String(currentState.rowId) === rowKey ? null : currentState,
    );
  }, []);

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

  const restorePendingDeleteWithUndo = useCallback((deletion: PendingDeleteWithUndo<T>): void => {
    setRows((currentRows) => {
      if (currentRows.some((row) => String(row.id) === String(deletion.rowId))) {
        return currentRows;
      }
      return orderRowsByStableIds(
        [...currentRows, deletion.row],
        deletion.rowsBeforeDelete.map((row) => row.id),
      );
    });
    setStableRowOrder((currentOrder) => {
      const currentOrderKeys = new Set(currentOrder.map(String));
      currentOrderKeys.add(String(deletion.rowId));
      const restoredOrder = deletion.stableRowOrderBeforeDelete.filter((orderedId) =>
        currentOrderKeys.has(String(orderedId)),
      );
      const restoredOrderKeys = new Set(restoredOrder.map(String));
      return [
        ...restoredOrder,
        ...currentOrder.filter((orderedId) => !restoredOrderKeys.has(String(orderedId))),
      ];
    });
    if (deletion.rowModeBeforeDelete) {
      setRowModesModel((currentModel) => ({
        ...currentModel,
        [deletion.rowId]: deletion.rowModeBeforeDelete!,
      }));
    }
  }, []);

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
  }, [api, deleteErrorMessage, removePendingDeleteWithUndo, restorePendingDeleteWithUndo, t]);

  const closeDeleteWithUndoSnackbar = useCallback((deletionId: string): void => {
    setPendingDeleteWithUndo((currentDeletions) =>
      currentDeletions.map((deletion) =>
        deletion.id === deletionId ? { ...deletion, visible: false } : deletion,
      ),
    );
  }, []);

  const undoDeleteWithUndo = useCallback((deletionId: string): void => {
    const deletion = pendingDeleteWithUndo.find((pendingDeletion) => pendingDeletion.id === deletionId);
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

  useEffect(() => {
    return () => {
      pendingDeleteTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      pendingDeleteTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!commandApiRef) {
      return;
    }

    commandApiRef.current = {
      addRow: handleAddClick,
      editSelectedRow: handleEditSelectedRow,
      deleteSelectedRow: handleDeleteSelectedRow,
      getSelectedRowId: () => selectedRowIds[0] ?? null,
      setDraftValues: async (rowId, values) => {
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
        setDirtyRowIds((previous) => {
          const next = new Set(previous);
          next.add(rowKey);
          return next;
        });
        setRowModesModel((previousModel) => ({
          ...previousModel,
          [rowId]: {
            ...(previousModel[rowId] ?? {}),
            mode: GridRowModes.Edit,
          },
        }));
      },
      reload: fetchData,
    };

    return () => {
      commandApiRef.current = null;
    };
  }, [commandApiRef, fetchData, getRowValidationErrors, gridApiRef, rowModesModel, rowsById, selectedRowIds]);

  /**
   * Handle row deletion
   */
  const handleDeleteClick = useCallback((id: GridRowId) => (): void => {
    const rowKey = String(id);
    const row = rowsById.get(rowKey) as T | undefined;
    if (!row) {
      return;
    }

    if (isUnsavedDraftRow(row)) {
      const remainingRows = (rows as T[]).filter((currentRow) => String(currentRow.id) !== rowKey);
      moveFocusAwayFromRemovedRow(id, remainingRows);
      clearRowInteractionState(id);
      setRows(remainingRows);
      setStableRowOrder((previousOrder) => previousOrder.filter((orderedId) => String(orderedId) !== rowKey));
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

      const remainingRows = (rows as T[]).filter((currentRow) => String(currentRow.id) !== rowKey);
      moveFocusAwayFromRemovedRow(id, remainingRows);
      setRows((prevRows) => prevRows.filter((currentRow) => String(currentRow.id) !== rowKey));
      setStableRowOrder((previousOrder) => previousOrder.filter((orderedId) => String(orderedId) !== rowKey));
      clearRowInteractionState(id);
      setError('');
      setPendingDeleteWithUndo((currentDeletions) => [...currentDeletions, pendingDeletion]);

      const timerId = window.setTimeout(() => {
        void finalizeDeleteWithUndo(pendingDeletion);
      }, DELETE_UNDO_DURATION_MS);
      pendingDeleteTimersRef.current.set(deletionId, timerId);
      return;
    }

    if (!confirmAction(deleteConfirmMessage)) return;

    const numericId = Number(id);
    if (numericId < 0) {
      // If it's a new unsaved row, just remove it from the grid
      const remainingRows = (rows as T[]).filter((currentRow) => String(currentRow.id) !== rowKey);
      moveFocusAwayFromRemovedRow(id, remainingRows);
      clearRowInteractionState(id);
      setRows(remainingRows);
      setStableRowOrder((previousOrder) => previousOrder.filter((orderedId) => String(orderedId) !== rowKey));
      return;
    }

    // Delete from API
    api.delete(numericId)
      .then(() => {
        const remainingRows = (rows as T[]).filter((currentRow) => String(currentRow.id) !== rowKey);
        moveFocusAwayFromRemovedRow(id, remainingRows);
        clearRowInteractionState(id);
        setRows(remainingRows);
        setStableRowOrder((previousOrder) => previousOrder.filter((orderedId) => String(orderedId) !== rowKey));
        setError('');
      })
      .catch((err) => {
        setError(deleteErrorMessage);
        console.error('Error deleting data:', err);
      });
  }, [
    api,
    deleteConfirmMessage,
    deleteErrorMessage,
    deleteUndoOptions,
    finalizeDeleteWithUndo,
    clearRowInteractionState,
    moveFocusAwayFromRemovedRow,
    rowModesModel,
    rows,
    rowsById,
    stableRowOrder,
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
    const actions: EditableDataGridRowAction<T>[] = [
      {
        id: 'edit',
        label: t('actions.edit'),
        icon: <EditIcon fontSize="small" />,
        onClick: (_row, helpers) => helpers.startEdit(row.id),
      },
    ];

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

  const getRowIdFromElement = (target: EventTarget | null): GridRowId | null => {
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
    return rowElement?.dataset.id ?? null;
  };

  const openRowActionContextMenu = useCallback((rowId: GridRowId, event: React.MouseEvent): void => {
    event.preventDefault();
    setSelectedRowIds([rowId]);
    setRowActionMenuState({ rowId, mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
  }, []);

  const closeRowActionMenu = useCallback((): void => {
    setRowActionMenuState(null);
    setLongPressFeedbackRowId(null);
  }, []);

  const menuRow = rowActionMenuState ? rowsById.get(String(rowActionMenuState.rowId)) as T | undefined : undefined;
  const shouldUseRowActions = Boolean(getRowActions || duplicateRow);
  const menuActions = menuRow && shouldUseRowActions ? resolveRowActions(menuRow) : [];
  const hasContextualRowActions = true;
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

  const clearRowActionLongPressTimer = useCallback((): void => {
    if (rowActionLongPressTimerRef.current === null) {
      return;
    }
    window.clearTimeout(rowActionLongPressTimerRef.current);
    rowActionLongPressTimerRef.current = null;
  }, []);

  const handleGridTouchStart = useCallback((event: TouchEvent<HTMLDivElement>): void => {
    if (!hasContextualRowActions || event.touches.length !== 1) {
      return;
    }
    const rowId = getRowIdFromElement(event.target);
    if (rowId === null || !rowsById.has(String(rowId))) {
      return;
    }
    const touch = event.touches[0];
    clearRowActionLongPressTimer();
    rowActionLongPressTimerRef.current = window.setTimeout(() => {
      setSelectedRowIds([rowId]);
      setLongPressFeedbackRowId(rowId);
      setRowActionMenuState({ rowId, mouseX: touch.clientX + 2, mouseY: touch.clientY - 6 });
      rowActionLongPressTimerRef.current = null;
    }, ROW_ACTION_LONG_PRESS_MS);
  }, [clearRowActionLongPressTimer, hasContextualRowActions, rowsById]);

  const handleGridTouchMove = useCallback((): void => {
    clearRowActionLongPressTimer();
  }, [clearRowActionLongPressTimer]);

  const handleGridTouchEnd = useCallback((): void => {
    clearRowActionLongPressTimer();
  }, [clearRowActionLongPressTimer]);

  useEffect(() => () => {
    clearRowActionLongPressTimer();
  }, [clearRowActionLongPressTimer]);

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
    if (!notes || !notes.fields || notes.fields.length === 0) {
      return columns.map((col) => keepDraftRowsVisibleForColumnFilters(col));
    }

    return columns.map((col) => {
      if (!notesFieldNames.includes(col.field)) {
        return keepDraftRowsVisibleForColumnFilters(col);
      }

      const fieldConfig = notes.fields.find((f) => f.field === col.field);

      return keepDraftRowsVisibleForColumnFilters({
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
  }, [columns, notes, notesEditor, notesFieldNames]);

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
              const rowId = getRowIdFromElement(event.target);
              if (rowId === null || !rowsById.has(String(rowId))) {
                return;
              }
              openRowActionContextMenu(rowId, event);
            } : undefined}
            onTouchStart={hasContextualRowActions ? handleGridTouchStart : undefined}
            onTouchMove={hasContextualRowActions ? handleGridTouchMove : undefined}
            onTouchEnd={hasContextualRowActions ? handleGridTouchEnd : undefined}
            onTouchCancel={hasContextualRowActions ? handleGridTouchEnd : undefined}
            sx={{
              position: 'relative',
              display: 'block',
              width: isContentSizedSurface ? 'fit-content' : '100%',
              minWidth: isContentSizedSurface ? 0 : '100%',
              maxWidth: '100%',
            }}
          >
            <DataGrid
          rows={rowsForGrid}
          columns={columnsWithActions}
          rowModesModel={rowModesModel}
          onRowModesModelChange={setRowModesModel}
          onRowEditStop={handleRowEditStop}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={handleProcessRowUpdateError}
          loading={loading}
          editMode="row"
          density={isMobile ? 'standard' : 'compact'}
          autoHeight
          hideFooter={false}
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
          onCellClick={(params) => {
            const rowKey = String(params.id);
            if (!rowSnapshotRef.current.has(rowKey)) {
              const row = rowsById.get(rowKey);
              if (row) {
                rowSnapshotRef.current.set(rowKey, row as T);
              }
            }
            setDirtyRowIds((prev) => new Set(prev).add(rowKey));
            handleEditableCellClick(params, rowModesModel, setRowModesModel);
          }}
          onCellKeyDown={(params: GridCellParams<T>, event) => {
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
