/**
 * Cultures (Kulturen) page component.
 * 
 * Manages crop cultures with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import type { GridColDef } from '@mui/x-data-grid';
import { cultureAPI, type Culture } from '../api/client';
import { EditableDataGrid, type EditableRow, type DataGridAPI } from '../components/EditableDataGrid';

/**
 * Row data type for Data Grid
 */
interface CultureRow extends Culture, EditableRow {
  id: number;
  isNew?: boolean;
}

function Cultures(): React.ReactElement {
  /**
   * Define columns for the Data Grid with inline editing
   */
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      editable: true,
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'variety',
      headerName: 'Sorte',
      width: 200,
      editable: true,
    },
    {
      field: 'days_to_harvest',
      headerName: 'Tage bis Ernte',
      width: 150,
      editable: true,
      type: 'number',
      preProcessEditCellProps: (params) => {
        const value = params.props.value;
        const hasError = value === undefined || value === null || value < 0;
        return { ...params.props, error: hasError };
      },
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
      <h1>Kulturen</h1>
      
      <EditableDataGrid<CultureRow>
        columns={columns}
        api={cultureAPI as unknown as DataGridAPI<CultureRow>}
        createNewRow={() => ({
          id: -Date.now(),
          name: '',
          variety: '',
          days_to_harvest: 0,
          notes: '',
          isNew: true,
        })}
        mapToRow={(culture) => ({
          ...culture,
          id: culture.id,
          name: culture.name || '',
          variety: culture.variety || '',
          days_to_harvest: culture.days_to_harvest || 0,
          notes: culture.notes || '',
        })}
        mapToApiData={(row) => ({
          name: row.name,
          variety: row.variety || '',
          days_to_harvest: row.days_to_harvest,
          notes: row.notes || '',
        })}
        validateRow={(row) => {
          if (!row.name || row.name.trim() === '') {
            return 'Name ist ein Pflichtfeld';
          }
          if (row.days_to_harvest === undefined || row.days_to_harvest < 0) {
            return 'Tage bis Ernte muss eine positive Zahl sein';
          }
          return null;
        }}
        loadErrorMessage="Fehler beim Laden der Kulturen"
        saveErrorMessage="Fehler beim Speichern der Kultur"
        deleteErrorMessage="Fehler beim Löschen der Kultur"
        deleteConfirmMessage="Möchten Sie diese Kultur wirklich löschen?"
        addButtonLabel="Neue Kultur hinzufügen"
      />
    </div>
  );
}

export default Cultures;
