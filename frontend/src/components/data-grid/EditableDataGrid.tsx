/**
 * Reusable Editable Data Grid component.
 * 
 * Provides Excel-like inline editing with validation and API integration.
 * Now supports spreadsheet-like autosave on blur.
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { DataGrid, GridRowModes } from '@mui/x-data-grid';
import { dataGridSx, dataGridFooterSx, deleteIconButtonSx } from './styles';
import { handleRowEditStop, handleEditableCellClick } from './handlers';
import type { GridColDef, GridRowsProp, GridRowModesModel, GridRowId } from '@mui/x-data-grid';
import { Box, Alert, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import axios, { AxiosError } from 'axios';
import { useNavigationBlocker } from '../../hooks/autosave';
import { useTranslation } from '../../i18n';

/**
 * Base interface for editable data grid rows
 */
export interface EditableRow {
  id: number;
  isNew?: boolean;
  [key: string]: unknown;
}

/**
 * API interface for CRUD operations
 */
export interface DataGridAPI<T> {
  list: () => Promise<{ data: { results: Partial<T>[] } }>;
  create: (data: Partial<T>) => Promise<{ data: T }>;
  update: (id: number, data: Partial<T>) => Promise<{ data: T }>;
  delete: (id: number) => Promise<void>;
}

/**
 * Props for the EditableDataGrid component
 */
export interface EditableDataGridProps<T extends EditableRow> {
  /** Column definitions for the grid (without actions column) */
  columns: GridColDef[];
  /** API handler for CRUD operations */
  api: DataGridAPI<T>;
  /** Function to create a new empty row */
  createNewRow: () => T;
  /** Function to map API data to grid row */
  mapToRow: (item: T) => T;
  /** Function to map grid row to API data for create/update */
  mapToApiData: (row: T) => Partial<T>;
  /** Function to validate row before save */
  validateRow: (row: T) => string | null;
  /** Error message when loading fails */
  loadErrorMessage: string;
  /** Error message when save fails */
  saveErrorMessage: string;
  /** Error message when delete fails */
  deleteErrorMessage: string;
  /** Delete confirmation message */
  deleteConfirmMessage: string;
  /** Aria label for add button */
  addButtonLabel: string;
  /** Whether to show delete action column (default: true) */
  showDeleteAction?: boolean;
  /** Optional initial row to add on mount (e.g., pre-filled from another page) */
  initialRow?: Partial<T>;
}

/**
 * Reusable editable data grid component
 */
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
}: EditableDataGridProps<T>): React.ReactElement {
  const [rows, setRows] = useState<GridRowsProp<T>>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [dataFetched, setDataFetched] = useState<boolean>(false);
  const initialRowProcessedRef = useRef<boolean>(false);
  const initialFetchDoneRef = useRef<boolean>(false);
  
  const { t } = useTranslation('common');

  // Check if any row is in edit mode (has unsaved changes)
  const hasUnsavedChanges = Object.values(rowModesModel).some(
    (mode) => mode.mode === GridRowModes.Edit
  );

  // Check if there's a validation error (indicating incomplete/invalid data)
  const hasValidationError = Boolean(error);

  // Block navigation if there are unsaved changes OR validation errors
  // This prevents losing incomplete data when required fields are missing
  useNavigationBlocker(
    hasUnsavedChanges || hasValidationError,
    hasValidationError 
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
  }, [initialRow, dataFetched, loading, createNewRow, columns]);

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



  /**
   * Extract user-friendly error message from Axios error response
   */
  const extractErrorMessage = (err: unknown): string => {
    console.log('extractErrorMessage called with:', err);
    
    if (axios.isAxiosError(err)) {
      const axiosError = err as AxiosError;
      console.log('Is Axios error, status:', axiosError.response?.status);
      console.log('Response data:', axiosError.response?.data);
      
      // Check if it's a 400 validation error
      if (axiosError.response?.status === 400) {
        const data = axiosError.response.data;
        console.log('Data type:', typeof data);
        
        // If data is a string, return it directly
        if (typeof data === 'string') {
          console.log('Returning string data:', data);
          return data;
        }
        
        // If data is an object with error fields
        if (data && typeof data === 'object') {
          const errors: string[] = [];
          
          // Field name translations (German)
          const fieldTranslations: Record<string, string> = {
            'area_usage_sqm': 'Flächennutzung',
            'planting_date': 'Pflanzdatum',
            'harvest_date': 'Erntebeginn',
            'harvest_end_date': 'Ernteende',
            'culture': 'Kultur',
            'bed': 'Beet',
            'notes': 'Notizen',
            'non_field_errors': 'Fehler',
          };
          
          // Extract errors from all fields
          Object.entries(data).forEach(([field, value]) => {
            console.log(`Processing field ${field}:`, value);
            const fieldName = fieldTranslations[field] || field;
            
            if (Array.isArray(value)) {
              // If value is an array of error messages
              value.forEach((msg: string) => {
                const errorMsg = `${fieldName}: ${msg}`;
                console.log('Adding error:', errorMsg);
                errors.push(errorMsg);
              });
            } else if (typeof value === 'string') {
              // If value is a single error message
              const errorMsg = `${fieldName}: ${value}`;
              console.log('Adding error:', errorMsg);
              errors.push(errorMsg);
            }
          });
          
          if (errors.length > 0) {
            const result = errors.join('\n');
            console.log('Returning joined errors:', result);
            return result;
          }
        }
      }
    }
    
    // Fallback to generic error message
    console.log('Fallback to generic error');
    return saveErrorMessage;
  };

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
        const response = await api.create(mapToApiData(newRow));
        setError('');
        if (!response.data.id) {
          throw new Error('API response missing ID');
        }
        
        // Remove the temporary row and add the saved row
        const savedRow = mapToRow(response.data as T);
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
        return mapToRow(response.data as T);
      }
    } catch (err) {
      // Extract user-friendly error message
      const errorMessage = extractErrorMessage(err);
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
   * Add delete action column if enabled
   */
  const columnsWithActions: GridColDef[] = showDeleteAction
    ? [
        ...columns,
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
    : columns;

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
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 },
            },
          }}
          slots={{
            footer: CustomFooter,
          }}
          sx={dataGridSx}
          onCellClick={(params) => handleEditableCellClick(params, rowModesModel, setRowModesModel)}
        />
      </Box>
    </>
  );
}
