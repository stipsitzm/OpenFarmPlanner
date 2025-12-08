/**
 * Planting Plans (Anbaupläne) page component.
 * 
 * Manages planting schedules with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Planting Plans page component
 */

import type { GridColDef } from '@mui/x-data-grid';
import { useTranslation } from '../i18n';
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
  const { t } = useTranslation(['plantingPlans', 'common']);
  
  /**
   * Define columns for the Data Grid with inline editing
   */
  const columns: GridColDef[] = [
    {
      field: 'culture_name',
      headerName: t('plantingPlans:columns.culture'),
      width: 200,
      editable: false,
    },
    {
      field: 'bed_name',
      headerName: t('plantingPlans:columns.bed'),
      width: 200,
      editable: false,
    },
    {
      field: 'planting_date',
      headerName: t('plantingPlans:columns.plantingDate'),
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
      headerName: t('plantingPlans:columns.harvestDate'),
      width: 180,
      editable: false,
      type: 'date',
      valueGetter: (value) => value ? new Date(value) : null,
    },
    {
      field: 'quantity',
      headerName: t('plantingPlans:columns.quantity'),
      width: 100,
      type: 'number',
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
      <h1>{t('plantingPlans:title')}</h1>
      
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
            return t('plantingPlans:validation.plantingDateRequired');
          }
          return null;
        }}
        loadErrorMessage={t('plantingPlans:errors.load')}
        saveErrorMessage={t('plantingPlans:errors.save')}
        deleteErrorMessage={t('plantingPlans:errors.delete')}
        deleteConfirmMessage={t('plantingPlans:confirmDelete')}
        addButtonLabel={t('plantingPlans:addButton')}
        showDeleteAction={true}
      />
    </div>
  );
}

export default PlantingPlans;
