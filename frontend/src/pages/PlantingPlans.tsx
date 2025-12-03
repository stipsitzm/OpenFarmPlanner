/**
 * Planting Plans (Anbaupläne) page component.
 * 
 * Manages planting schedules with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Planting Plans page component
 */

import type { GridColDef } from '@mui/x-data-grid';
import { plantingPlanAPI, type PlantingPlan } from '../api/client';
import { EditableDataGrid, type EditableRow, type DataGridAPI } from '../components/EditableDataGrid';

/**
 * Row data type for Data Grid
 */
interface PlantingPlanRow extends PlantingPlan, EditableRow {
  id: number;
  isNew?: boolean;
}

function PlantingPlans(): React.ReactElement {
  /**
   * Define columns for the Data Grid with inline editing
   */
  const columns: GridColDef[] = [
    {
      field: 'culture_name',
      headerName: 'Kultur',
      width: 200,
      editable: false,
    },
    {
      field: 'bed_name',
      headerName: 'Beet',
      width: 200,
      editable: false,
    },
    {
      field: 'planting_date',
      headerName: 'Pflanzdatum',
      width: 150,
      type: 'date',
      editable: true,
      valueGetter: (value) => value ? new Date(value) : null,
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value;
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'harvest_date',
      headerName: 'Erntedatum (berechnet)',
      width: 180,
      editable: false,
      type: 'date',
      valueGetter: (value) => value ? new Date(value) : null,
    },
    {
      field: 'quantity',
      headerName: 'Menge',
      width: 100,
      type: 'number',
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
      <h1>Anbaupläne</h1>
      
      <EditableDataGrid<PlantingPlanRow>
        columns={columns}
        api={plantingPlanAPI as unknown as DataGridAPI<PlantingPlanRow>}
        createNewRow={() => ({
          id: -Date.now(),
          culture: 0,
          bed: 0,
          planting_date: '',
          quantity: undefined,
          notes: '',
          isNew: true,
        })}
        mapToRow={(plan) => ({
          ...plan,
          id: plan.id!,
          culture: plan.culture,
          culture_name: plan.culture_name || '',
          bed: plan.bed,
          bed_name: plan.bed_name || '',
          planting_date: plan.planting_date,
          harvest_date: plan.harvest_date,
          quantity: plan.quantity,
          notes: plan.notes || '',
        })}
        mapToApiData={(row) => ({
          culture: row.culture,
          bed: row.bed,
          planting_date: row.planting_date,
          quantity: row.quantity,
          notes: row.notes || '',
        })}
        validateRow={(row) => {
          if (!row.planting_date) {
            return 'Pflanzdatum ist ein Pflichtfeld';
          }
          return null;
        }}
        loadErrorMessage="Fehler beim Laden der Anbaupläne"
        saveErrorMessage="Fehler beim Speichern des Anbau plans"
        deleteErrorMessage="Fehler beim Löschen des Anbau plans"
        deleteConfirmMessage="Möchten Sie diesen Anbauplan wirklich löschen?"
        addButtonLabel="Neuen Anbauplan hinzufügen"
        showDeleteAction={true}
      />
    </div>
  );
}

export default PlantingPlans;
