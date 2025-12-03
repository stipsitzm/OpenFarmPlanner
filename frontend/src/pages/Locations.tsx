/**
 * Locations (Standorte) page component.
 * 
 * Manages farm locations with Excel-like editable data grid.
 * Uses MUI Data Grid for inline editing with validation.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Locations page component
 */

import { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridRowModes, GridRowEditStopReasons } from '@mui/x-data-grid';
import type { GridColDef, GridRowsProp, GridRowModesModel, GridEventListener, GridRowId } from '@mui/x-data-grid';
import { Box, Button, Alert } from '@mui/material';
import { locationAPI, type Location } from '../api/client';

/**
 * Row data type for Data Grid with all optional fields for new rows
 */
interface LocationRow extends Location {
  id: number;
  isNew?: boolean;
}

function Locations(): React.ReactElement {
  const [rows, setRows] = useState<GridRowsProp<LocationRow>>([]);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Fetch locations from API and populate grid
   */
  const fetchLocations = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await locationAPI.list();
      // Map API response to grid rows with guaranteed id
      const locationRows: LocationRow[] = response.data.results
        .filter((loc): loc is Required<Pick<Location, 'id'>> & Location => loc.id !== undefined)
        .map(loc => ({
          ...loc,
          id: loc.id,
          name: loc.name || '',
          address: loc.address || '',
          notes: loc.notes || '',
        }));
      setRows(locationRows);
      setError('');
    } catch (err) {
      setError('Fehler beim Laden der Standorte');
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  /**
   * Handle adding a new row to the grid
   */
  const handleAddClick = (): void => {
    // Generate temporary negative ID for new row
    const id = -Date.now();
    const newRow: LocationRow = { id, name: '', address: '', notes: '', isNew: true };
    setRows((oldRows) => [newRow, ...oldRows]);
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [id]: { mode: GridRowModes.Edit, fieldToFocus: 'name' },
    }));
  };

  /**
   * Handle row edit stop event
   */
  const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event): void => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  /**
   * Process row update - save to API
   * This is called when the user commits the edit (e.g., by pressing Enter or clicking outside)
   */
  const processRowUpdate = async (newRow: LocationRow): Promise<LocationRow> => {
    // Validate required fields
    if (!newRow.name || newRow.name.trim() === '') {
      setError('Name ist ein Pflichtfeld');
      throw new Error('Name ist ein Pflichtfeld');
    }

    try {
      if (newRow.isNew) {
        // Create new location via API
        const response = await locationAPI.create({
          name: newRow.name,
          address: newRow.address || '',
          notes: newRow.notes || '',
        });
        setError('');
        // Replace temporary row with server response
        if (!response.data.id) {
          throw new Error('API response missing location ID');
        }
        return { ...response.data, id: response.data.id };
      } else {
        // Update existing location via API
        const response = await locationAPI.update(newRow.id, {
          name: newRow.name,
          address: newRow.address || '',
          notes: newRow.notes || '',
        });
        setError('');
        if (!response.data.id) {
          throw new Error('API response missing location ID');
        }
        return { ...response.data, id: response.data.id };
      }
    } catch (err) {
      setError('Fehler beim Speichern des Standorts');
      console.error('Error saving location:', err);
      throw err;
    }
  };

  /**
   * Handle row update errors
   */
  const handleProcessRowUpdateError = (error: Error): void => {
    console.error('Row update error:', error);
    setError(error.message || 'Fehler beim Speichern');
  };

  /**
   * Handle row deletion
   */
  const handleDeleteClick = (id: GridRowId) => (): void => {
    if (!window.confirm('Möchten Sie diesen Standort wirklich löschen?')) return;

    const numericId = Number(id);
    if (numericId < 0) {
      // If it's a new unsaved row, just remove it from the grid
      setRows((prevRows) => prevRows.filter((row) => row.id !== id));
      return;
    }

    // Delete from API
    locationAPI.delete(numericId)
      .then(() => {
        setRows((prevRows) => prevRows.filter((row) => row.id !== id));
        setError('');
      })
      .catch((err) => {
        setError('Fehler beim Löschen des Standorts');
        console.error('Error deleting location:', err);
      });
  };

  /**
   * Define columns for the Data Grid with inline editing
   */
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      editable: true,
      // Validation: name is required
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'address',
      headerName: 'Adresse',
      width: 300,
      editable: true,
    },
    {
      field: 'notes',
      headerName: 'Notizen',
      width: 300,
      editable: true,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Aktionen',
      width: 100,
      cellClassName: 'actions',
      getActions: ({ id }) => {
        return [
          <Button
            key={`delete-${id}`}
            onClick={handleDeleteClick(id)}
            color="error"
            size="small"
          >
            Löschen
          </Button>,
        ];
      },
    },
  ];

  return (
    <div className="page-container">
      <h1>Standorte</h1>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleAddClick}
          sx={{ mb: 2 }}
        >
          Neuen Standort hinzufügen
        </Button>
      </Box>

      {/* MUI Data Grid for Excel-like editing experience */}
      <Box sx={{ height: 500, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowModesModel={rowModesModel}
          onRowModesModelChange={setRowModesModel}
          onRowEditStop={handleRowEditStop}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={handleProcessRowUpdateError}
          loading={loading}
          editMode="row"
          pageSizeOptions={[5, 10, 25]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 10 },
            },
          }}
          sx={{
            '& .MuiDataGrid-cell--editable': {
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? '#383838' : '#f5f5f5',
            },
          }}
        />
      </Box>
    </div>
  );
}

export default Locations;
