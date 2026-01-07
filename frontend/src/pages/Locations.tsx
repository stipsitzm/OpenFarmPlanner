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
import { useTranslation } from '../i18n';
import { locationAPI, type Location } from '../api/api';
import { EditableDataGrid, type EditableRow, type DataGridAPI } from '../components/data-grid';

/**
 * Row data type for Data Grid with all optional fields for new rows
 */
interface LocationRow extends Location, EditableRow {
  id: number;
  isNew?: boolean;
}


function Locations(): React.ReactElement {
  const { t } = useTranslation(['locations', 'common']);
  
  /**
   * Define columns for the Data Grid with inline editing
   */
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t('common:fields.name'),
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
      headerName: t('common:fields.address'),
      width: 300,
      editable: true,
    },
    {
      field: 'notes',
      headerName: t('common:fields.notes'),
      width: 300,
      editable: true,
    },
  ];

  return (
    <div className="page-container">
      <h1>{t('locations:title')}</h1>
      
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
            return t('locations:validation.nameRequired');
          }
          return null;
        }}
        loadErrorMessage={t('locations:errors.load')}
        saveErrorMessage={t('locations:errors.save')}
        deleteErrorMessage={t('locations:errors.delete')}
        deleteConfirmMessage={t('locations:confirmDelete')}
        addButtonLabel={t('locations:addButton')}
      />
    </div>
  );
}

export default Locations;
