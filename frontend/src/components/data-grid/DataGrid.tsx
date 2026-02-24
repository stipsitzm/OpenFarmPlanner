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
 * Changes are automatically saved when you:
 * - Click outside the row (blur)
 * - Press Tab to move to another field
 * - Click on a different row
 * Navigation is blocked if there are unsaved changes (row in edit mode).
 */

import { useState, useEffect, useCallback, useRef, useMemo, type MutableRefObject } from 'react';
import { DataGrid, GridRowModes } from '@mui/x-data-grid';
import { dataGridSx, dataGridFooterSx, deleteIconButtonSx } from './styles';
import { handleRowEditStop, handleEditableCellClick } from './handlers';
import type { GridColDef, GridRowsProp, GridRowModesModel, GridRowId, GridSortModel } from '@mui/x-data-grid';
import { Box, Alert, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigationBlocker } from '../../hooks/autosave';
import { usePersistentSortModel } from '../../hooks/usePersistentSortModel';
import { useTranslation } from '../../i18n';
import { NotesCell } from './NotesCell';
import { NotesDrawer } from './NotesDrawer';
import { getPlainExcerpt } from './markdown';
import { useNotesEditor } from './useNotesEditor';
import { extractApiErrorMessage } from '../../api/errors';

export interface EditableRow {
  id: number;
  isNew?: boolean;
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
}
export interface NotesFieldConfig {
  field: string;
  labelKey?: string;
  titleKey?: string;
  attachmentNoteIdField?: string;
  attachmentCountField?: string;
}

export interface EditableDataGridProps<T extends EditableRow> {
  columns: GridColDef[]; // Column definitions for the grid (without actions column)
  api: DataGridAPI<T>; // API handler for CRUD operations
  createNewRow: () => T; // Function to create a new empty row
  mapToRow: (item: T) => T; // Function to map API data to grid row
  mapToApiData: (row: T) => Partial<T>; // Function to map grid row to API data for create/update
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
}

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
}: EditableDataGridProps<T>): React.ReactElement {
  const [rows, setRows] = useState<GridRowsProp<T>>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [dataFetched, setDataFetched] = useState<boolean>(false);
  const initialRowProcessedRef = useRef<boolean>(false);
  const initialFetchDoneRef = useRef<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<GridRowId[]>([]);
  
  const { t } = useTranslation('common');
  const { sortModel, setSortModel } = usePersistentSortModel({
    tableKey: tableKey ?? 'editableDataGrid',
    defaultSortModel,
    allowedFields: columns.map((column) => column.field),
    persistInUrl: persistSortInUrl,
  });

  const saveUpdatedRow = useCallback(async (updatedRow: T): Promise<T> => {
    const numericId = Number(updatedRow.id);
    if (numericId < 0 || updatedRow.isNew) {
      setRows((prevRows) =>
        prevRows.map((row) => (row.id === updatedRow.id ? updatedRow : row))
      );
      return updatedRow;
    }

    const response = await api.update(numericId, mapToApiData(updatedRow));
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

  // Check if any row is in edit mode (has unsaved changes)
  const hasUnsavedChanges = Object.values(rowModesModel).some(
    (mode) => mode.mode === GridRowModes.Edit
  );

  // Check if there's a validation error (indicating incomplete/invalid data)
  const hasValidationError = Boolean(error);
  
  // Check if any row in edit mode has validation errors
  // This prevents navigation when user has incomplete data even if blur hasn't happened yet
  const rowsById = useMemo(() => {
    return new Map(rows.map((row) => [String(row.id), row]));
  }, [rows]);

  const hasInvalidRowInEditMode = useMemo(() => {
    if (!hasUnsavedChanges) return false;
    
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
  }, [hasUnsavedChanges, rowModesModel, rowsById, validateRow]);

  // Block navigation if there are unsaved changes with invalid data OR validation errors showing
  // This prevents losing incomplete data when required fields are missing
  useNavigationBlocker(
    hasUnsavedChanges || hasValidationError || hasInvalidRowInEditMode,
    hasValidationError || hasInvalidRowInEditMode
      ? t('messages.validationErrors')
      : t('messages.unsavedChanges')
  );

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
      setError('');
      setDataFetched(true);
    } catch (err) {
      setError(loadErrorMessage);
      console.error('Error fetching data:', err);
      setDataFetched(true);
    } finally {
      setLoading(false);
    }
  }, [api, mapToRow, loadErrorMessage]);

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
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [newRow.id]: { mode: GridRowModes.Edit, fieldToFocus: columns[0]?.field },
    }));
  };

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

  useEffect(() => {
    if (!commandApiRef) {
      return;
    }

    commandApiRef.current = {
      addRow: handleAddClick,
      editSelectedRow: handleEditSelectedRow,
      deleteSelectedRow: handleDeleteSelectedRow,
      getSelectedRowId: () => selectedRowIds[0] ?? null,
    };

    return () => {
      commandApiRef.current = null;
    };
  }, [commandApiRef, handleAddClick, selectedRowIds]);


  /**
   * Process row update - save to API
   */
  const processRowUpdate = async (newRow: T): Promise<T> => {
    // Clear previous error before validating
    // This ensures dropdown selections and other changes trigger fresh validation
    setError('');
    
    // Validate required fields
    const validationError = validateRow(newRow);
    if (validationError) {
      setError(validationError);
      throw new Error(validationError);
    }

    try {
      if (newRow.isNew) {
        // Create new item via API
        console.log('[DEBUG] processRowUpdate creating new row:', newRow);
        const response = await api.create(mapToApiData(newRow));
        console.log('[DEBUG] processRowUpdate API response:', response.data);
        setError('');
        if (!response.data.id) {
          throw new Error('API response missing ID');
        }
        
        // Remove the temporary row and add the saved row
        const savedRow = mapToRow(response.data as T);
        console.log('[DEBUG] processRowUpdate mapped saved row:', savedRow);
        setRows((prevRows) => {
          // Remove the temporary row with negative ID
          const filteredRows = prevRows.filter(row => row.id !== newRow.id);
          // Add the saved row at the beginning
          return [savedRow, ...filteredRows];
        });
        
        return savedRow;
      } else {
        // Update existing item via API
        console.log('[DEBUG] processRowUpdate updating row:', newRow);
        const response = await api.update(newRow.id, mapToApiData(newRow));
        console.log('[DEBUG] processRowUpdate API response:', response.data);
        setError('');
        if (!response.data.id) {
          throw new Error('API response missing ID');
        }
        // Map the response through mapToRow to ensure all fields are properly formatted
        // This is important for auto-calculated fields like harvest dates
        const mappedRow = mapToRow(response.data as T);
        console.log('[DEBUG] processRowUpdate mapped row:', mappedRow);
        return mappedRow;
      }
    } catch (err) {
      // Extract user-friendly error message
      const errorMessage = extractApiErrorMessage(err, t, saveErrorMessage);
      console.log('Extracted error message:', errorMessage);
      setError(errorMessage);
      console.error('Error saving data:', err);
      throw err;
    }
  };

  /**
   * Handle row update errors
   */
  const handleProcessRowUpdateError = (error: Error): void => {
    console.error('Row update error:', error);
    setError(error.message || saveErrorMessage);
  };

  /**
   * Handle row deletion
   */
  const handleDeleteClick = (id: GridRowId) => (): void => {
    if (!window.confirm(deleteConfirmMessage)) return;

    const numericId = Number(id);
    if (numericId < 0) {
      // If it's a new unsaved row, just remove it from the grid
      setRows((prevRows) => prevRows.filter((row) => row.id !== id));
      return;
    }

    // Delete from API
    api.delete(numericId)
      .then(() => {
        setRows((prevRows) => prevRows.filter((row) => row.id !== id));
        setError('');
      })
      .catch((err) => {
        setError(deleteErrorMessage);
        console.error('Error deleting data:', err);
      });
  };

  /**
   * Custom footer component with add button
   */
  const CustomFooter = (): React.ReactElement => {
    return (
      <Box sx={dataGridFooterSx}>
        <IconButton
          onClick={handleAddClick}
          color="primary"
          size="small"
          aria-label={addButtonLabel}
        >
          <AddIcon />
        </IconButton>
      </Box>
    );
  };

  /**
   * Process columns to replace notes fields with NotesCell renderer
   */
  const processedColumns: GridColDef[] = useMemo(() => {
    if (!notes || !notes.fields || notes.fields.length === 0) {
      return columns;
    }

    const notesFieldNames = notes.fields.map((f) => f.field);

    return columns.map((col) => {
      if (!notesFieldNames.includes(col.field)) {
        return col;
      }

      const fieldConfig = notes.fields.find((f) => f.field === col.field);

      return {
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
              onOpen={() => notesEditor.handleOpen(params.id, col.field)}
              onOpenAttachments={(event) => {
                event.preventDefault();
                event.stopPropagation();
                notesEditor.handleOpen(params.id, col.field, { focusAttachments: true });
              }}
            />
          );
        },
      };
    });
  }, [columns, notes, notesEditor]);

  /**
   * Add delete action column if enabled
   */
  const columnsWithActions: GridColDef[] = showDeleteAction
    ? [
        ...processedColumns,
        {
          field: 'actions',
          type: 'actions',
          headerName: '',
          width: 70,
          cellClassName: 'actions',
          getActions: ({ id }) => {
            return [
              <IconButton
                key={`delete-${id}`}
                onClick={handleDeleteClick(id)}
                size="small"
                sx={deleteIconButtonSx}
                aria-label="Löschen"
              >
                <CloseIcon />
              </IconButton>,
            ];
          },
        },
      ]
    : processedColumns;

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
      
      <Box sx={{ width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columnsWithActions}
          rowModesModel={rowModesModel}
          onRowModesModelChange={setRowModesModel}
          onRowEditStop={handleRowEditStop}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={handleProcessRowUpdateError}
          loading={loading}
          editMode="row"
          autoHeight
          hideFooter={true}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          rowSelectionModel={{ type: "include", ids: new Set(selectedRowIds) }}
          onRowSelectionModelChange={(nextModel) => setSelectedRowIds(Array.from(nextModel.ids))}
          slots={{
            footer: CustomFooter,
          }}
          sx={dataGridSx}
          onCellClick={(params) => handleEditableCellClick(params, rowModesModel, setRowModesModel)}
        />
      </Box>

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
