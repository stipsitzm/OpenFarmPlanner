/**
 * Locations (Standorte) page component.
 * 
 * Manages farm locations with Excel-like editable data grid.
 * Uses MUI Data Grid for inline editing with validation.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Locations page component
 */

import type { GridColDef } from '@mui/x-data-grid';
import { locationAPI, type Location } from '../api/client';
import { EditableDataGrid, type EditableRow, type DataGridAPI } from '../components/EditableDataGrid';

/**
 * Row data type for Data Grid with all optional fields for new rows
 */
interface LocationRow extends Location, EditableRow {
  id: number;
  isNew?: boolean;
}


function Locations(): React.ReactElement {
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
  ];

  return (
    <div className="page-container">
      <h1>Standorte</h1>
      
      <EditableDataGrid<LocationRow>
        columns={columns}
        api={locationAPI as unknown as DataGridAPI<LocationRow>}
        createNewRow={() => ({
          id: -Date.now(),
          name: '',
          address: '',
          notes: '',
          isNew: true,
        })}
        mapToRow={(loc) => ({
          ...loc,
          id: loc.id,
          name: loc.name || '',
          address: loc.address || '',
          notes: loc.notes || '',
        })}
        mapToApiData={(row) => ({
          name: row.name,
          address: row.address || '',
          notes: row.notes || '',
        })}
        validateRow={(row) => {
          if (!row.name || row.name.trim() === '') {
            return 'Name ist ein Pflichtfeld';
          }
          return null;
        }}
        loadErrorMessage="Fehler beim Laden der Standorte"
        saveErrorMessage="Fehler beim Speichern des Standorts"
        deleteErrorMessage="Fehler beim Löschen des Standorts"
        deleteConfirmMessage="Möchten Sie diesen Standort wirklich löschen?"
        addButtonLabel="Neuen Standort hinzufügen"
      />
    </div>
  );
}

export default Locations;
