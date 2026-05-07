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
import type { GridColDef, GridRowsProp, GridRowModesModel, GridRowId, GridSortModel, GridCellParams, GridRowParams } from '@mui/x-data-grid';
import { Box, Alert, IconButton, Chip, Button, Tooltip, useMediaQuery } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigationBlocker } from '../../hooks/autosave';
import { usePersistentSortModel } from '../../hooks/usePersistentSortModel';
import { useTranslation } from '../../i18n';
import { NotesCell } from './NotesCell';
import { NotesDrawer } from './NotesDrawer';
import { getPlainExcerpt } from './markdown';
import { useNotesEditor } from './useNotesEditor';
import { extractApiErrorMessage } from '../../api/errors';
import { germanDataGridLocaleText } from './localeText';

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
  reload: () => Promise<void>;
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
  getRowValidationErrors?: (row: T) => Record<string, string>;
  showAddAction?: boolean;
  showFooterEditControls?: boolean;
  showRowEditActions?: boolean;
  onRowsStateChange?: (rows: T[]) => void;
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
  getRowValidationErrors,
  showAddAction = true,
  showFooterEditControls = true,
  showRowEditActions = false,
  onRowsStateChange,
}: EditableDataGridProps<T>): React.ReactElement {
  const [rows, setRows] = useState<GridRowsProp<T>>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [dataFetched, setDataFetched] = useState<boolean>(false);
  const initialRowProcessedRef = useRef<boolean>(false);
  const initialFetchDoneRef = useRef<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<GridRowId[]>([]);
  const [dirtyRowIds, setDirtyRowIds] = useState<Set<string>>(new Set());
  const [activeValidationErrors, setActiveValidationErrors] = useState<Record<string, Record<string, string>>>({});
  const rowSnapshotRef = useRef<Map<string, T>>(new Map());
  const isMobile = useMediaQuery('(max-width:900px)');
  
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

  const hasRowsInEditMode = Object.values(rowModesModel).some(
    (mode) => mode.mode === GridRowModes.Edit
  );
  const hasUnsavedChanges = hasRowsInEditMode || dirtyRowIds.size > 0;

  // Check if there's a validation error (indicating incomplete/invalid data)
  const hasValidationError = Boolean(error);
  
  // Check if any row in edit mode has validation errors
  // This prevents navigation when user has incomplete data even if blur hasn't happened yet
  const rowsById = useMemo(() => {
    return new Map(rows.map((row) => [String(row.id), row]));
  }, [rows]);

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

  const handleDiscardRowChanges = useCallback((rowId: GridRowId): void => {
    const rowKey = String(rowId);
    const snapshot = rowSnapshotRef.current.get(rowKey);
    if (snapshot) {
      setRows((prevRows) => prevRows.map((row) => (String(row.id) === rowKey ? snapshot : row)));
    } else if (Number(rowId) < 0) {
      setRows((prevRows) => prevRows.filter((row) => String(row.id) !== rowKey));
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

  const handleSaveAllDirtyRows = useCallback((): void => {
    const editingRowIds = Object.entries(rowModesModel)
      .filter(([, mode]) => mode.mode === GridRowModes.Edit)
      .map(([id]) => id);
    if (editingRowIds.length === 0) {
      return;
    }
    setRowModesModel((oldModel) => {
      const nextModel = { ...oldModel };
      for (const rowId of editingRowIds) {
        nextModel[rowId] = { mode: GridRowModes.View };
      }
      return nextModel;
    });
  }, [rowModesModel]);

  const handleSaveRow = useCallback((rowId: GridRowId): void => {
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [rowId]: { mode: GridRowModes.View },
    }));
  }, []);

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
      reload: fetchData,
    };

    return () => {
      commandApiRef.current = null;
    };
  }, [commandApiRef, fetchData, selectedRowIds]);


  /**
   * Process row update - save to API
   */
  const processRowUpdate = async (newRow: T): Promise<T> => {
    // Clear previous error before validating
    // This ensures dropdown selections and other changes trigger fresh validation
    setError('');
    
    // Validate required fields
    const validationError = validateRow(newRow);
    const rowKey = String(newRow.id);
    const fieldErrors = getRowValidationErrors?.(newRow) ?? {};
    setActiveValidationErrors((prev) => ({
      ...prev,
      [rowKey]: fieldErrors,
    }));
    if (validationError) {
      if (newRow.isNew) {
        throw new Error(validationError);
      }
      setError(validationError);
      throw new Error(validationError);
    }

    try {
      if (newRow.isNew) {
        // Create new item via API
        const response = await api.create(mapToApiData(newRow));
        setError('');
        if (!response.data.id) {
          throw new Error('API response missing ID');
        }
        
        // Remove the temporary row and add the saved row
        const savedRow = mapToRow(response.data as T);
        rowSnapshotRef.current.set(String(savedRow.id), savedRow);
        setRows((prevRows) => {
          // Remove the temporary row with negative ID
          const filteredRows = prevRows.filter(row => row.id !== newRow.id);
          // Add the saved row at the beginning
          return [savedRow, ...filteredRows];
        });
        
        return savedRow;
      } else {
        // Update existing item via API
        const response = await api.update(newRow.id, mapToApiData(newRow));
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
      // Extract user-friendly error message
      const errorMessage = extractApiErrorMessage(err, t, saveErrorMessage);
      setError(errorMessage);
      console.error('Error saving data:', err);
      throw new Error(errorMessage);
    }
  };

  /**
   * Handle row update errors
   */
  const handleProcessRowUpdateError = (error: unknown): void => {
    console.error('Row update error:', error);
    if (error instanceof Error && error.message) {
      setError(error.message);
      return;
    }
    const errorMessage = extractApiErrorMessage(error, t, saveErrorMessage);
    setError(errorMessage);
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
            <Button size="small" variant="contained" onClick={handleSaveAllDirtyRows}>
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
              compactIndicator={Boolean(fieldConfig?.compactIndicator)}
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
              const isEditing = rowModesModel[rowId]?.mode === GridRowModes.Edit;

              return (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, width: '100%', justifyContent: 'flex-end' }}>
                  {isEditing && (
                    <>
                      <Tooltip title={t('actions.saveRow')} arrow>
                        <IconButton size="small" color="primary" aria-label={t('actions.save')} onClick={() => handleSaveRow(rowId)}>
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
                  aria-label="Löschen"
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
      
      <Box sx={{ width: '100%', overflowX: 'auto', overflowY: 'visible' }}>
        <Box sx={{ display: 'block', width: '100%', minWidth: 0 }}>
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
          density={isMobile ? 'standard' : 'compact'}
          autoHeight
          hideFooter={false}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          rowSelectionModel={{ type: "include", ids: new Set(selectedRowIds) }}
          onRowSelectionModelChange={(nextModel) => setSelectedRowIds(Array.from(nextModel.ids))}
          slots={{
            footer: CustomFooter,
          }}
          sx={{ ...dataGridSx, width: '100%' }}
          getRowClassName={(params) => {
            const rowKey = String(params.id);
            if (rowModesModel[params.id]?.mode === GridRowModes.Edit) {
              return 'ofp-row-editing';
            }
            if (dirtyRowIds.has(rowKey)) {
              return 'ofp-row-dirty';
            }
            return '';
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
            if (event.key === 'Escape') {
              event.preventDefault();
              handleDiscardRowChanges(params.id);
              return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
              event.preventDefault();
              handleSaveRow(params.id);
            }
          }}
          localeText={germanDataGridLocaleText}
          />
        </Box>
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
