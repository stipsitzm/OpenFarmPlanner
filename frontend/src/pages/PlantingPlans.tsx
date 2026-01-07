/**
 * Planting Plans (Anbaupläne) page component.
 * 
 * Manages planting schedules with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Planting Plans page component
 */

import { useState, useEffect, useMemo } from 'react';
import type { GridColDef } from '@mui/x-data-grid';
import { useTranslation } from '../i18n';
import { plantingPlanAPI, cultureAPI, bedAPI, type PlantingPlan, type Culture, type Bed } from '../api/api';
import { EditableDataGrid, type EditableRow, type DataGridAPI } from '../components/data-grid';

/**
 * Row data type for Data Grid
 */
interface PlantingPlanRow extends PlantingPlan, EditableRow {
  id: number;
  isNew?: boolean;
}

function PlantingPlans(): React.ReactElement {
  const { t } = useTranslation(['plantingPlans', 'common']);
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);

  /**
   * Fetch cultures and beds for dropdowns
   */
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const [culturesResponse, bedsResponse] = await Promise.all([
          cultureAPI.list(),
          bedAPI.list(),
        ]);
        setCultures(culturesResponse.data.results);
        setBeds(bedsResponse.data.results);
      } catch (err) {
        console.error('Error fetching cultures and beds:', err);
      }
    };
    fetchData();
  }, []);
  
  /**
   * Define columns for the Data Grid with inline editing
   * Recalculates when cultures or beds change to update dropdown options
   */
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'culture',
      headerName: t('plantingPlans:columns.culture'),
      flex: 1,
      minWidth: 180,
      editable: true,
      type: 'singleSelect',
      valueOptions: cultures.filter(c => c.id !== undefined).map(c => ({ value: c.id!, label: c.variety ? `${c.name} (${c.variety})` : c.name })),
      valueFormatter: (value) => {
        const culture = cultures.find(c => c.id === value);
        return culture ? (culture.variety ? `${culture.name} (${culture.variety})` : culture.name) : '';
      },
      valueSetter: (value, row) => {
        // Ensure we always store the numeric ID, not the label
        const numericValue = typeof value === 'number' ? value : Number(value);
        return { ...row, culture: numericValue };
      },
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value === 0;
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'bed',
      headerName: t('plantingPlans:columns.bed'),
      flex: 1.2,
      minWidth: 200,
      editable: true,
      type: 'singleSelect',
      valueOptions: beds.filter(b => b.id !== undefined).map(b => {
        const baseName = b.field_name ? `${b.field_name} - ${b.name}` : b.name;
        const areaInfo = b.area_sqm ? ` (${b.area_sqm} m²)` : '';
        return { value: b.id!, label: `${baseName}${areaInfo}` };
      }),
      valueFormatter: (value) => {
        const bed = beds.find(b => b.id === value);
        if (!bed) return '';
        const baseName = bed.field_name ? `${bed.field_name} - ${bed.name}` : bed.name;
        const areaInfo = bed.area_sqm ? ` (${bed.area_sqm} m²)` : '';
        return `${baseName}${areaInfo}`;
      },
      valueSetter: (value, row) => {
        // Ensure we always store the numeric ID, not the label string
        const numericValue = typeof value === 'number' ? value : Number(value);
        return { ...row, bed: numericValue };
      },
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value === 0;
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'planting_date',
      headerName: t('plantingPlans:columns.plantingDate'),
      flex: 0.8,
      minWidth: 130,
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
      headerName: t('plantingPlans:columns.harvestStartDate'),
      flex: 0.8,
      minWidth: 130,
      editable: false,
      type: 'date',
      valueGetter: (value) => value ? new Date(value) : null,
    },
    {
      field: 'harvest_end_date',
      headerName: t('plantingPlans:columns.harvestEndDate'),
      flex: 0.8,
      minWidth: 130,
      editable: false,
      type: 'date',
      valueGetter: (value) => value ? new Date(value) : null,
    },
    {
      field: 'area_usage_sqm',
      headerName: t('plantingPlans:columns.areaUsage'),
      flex: 0.6,
      minWidth: 110,
      type: 'number',
      editable: true,
    },
    {
      field: 'notes',
      headerName: t('common:fields.notes'),
      flex: 1.5,
      minWidth: 200,
      editable: true,
    },
  ], [cultures, beds, t]);

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
          planting_date: null as any, // Allow null initially, will be set when user selects
          quantity: undefined,
          area_usage_sqm: undefined,
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
          harvest_end_date: plan.harvest_end_date,
          quantity: plan.quantity,
          area_usage_sqm: plan.area_usage_sqm,
          notes: plan.notes || '',
        })}
        mapToApiData={(row) => {
          const isDate = (val: unknown): val is Date => val instanceof Date;

          // Convert date from Date object to string if needed
          // Use local date string to avoid timezone offset issues
          let plantingDate: string;
          if (isDate(row.planting_date)) {
            const year = row.planting_date.getFullYear();
            const month = String(row.planting_date.getMonth() + 1).padStart(2, '0');
            const day = String(row.planting_date.getDate()).padStart(2, '0');
            plantingDate = `${year}-${month}-${day}`;
          } else if (typeof row.planting_date === 'string') {
            plantingDate = row.planting_date;
          } else {
            plantingDate = '';
          }
          
          // Ensure culture and bed are numeric IDs, not label strings
          // DataGrid singleSelect can sometimes provide the label instead of value
          let cultureId: number;
          let bedId: number;
          
          if (typeof row.culture === 'number') {
            cultureId = row.culture;
          } else {
            // If it's a string, it's the label - should not happen but handle gracefully
            console.warn('Culture field contains non-numeric value:', row.culture);
            cultureId = 0; // This will cause validation error
          }
          
          if (typeof row.bed === 'number') {
            bedId = row.bed;
          } else {
            // If it's a string, it's the label - should not happen but handle gracefully
            console.warn('Bed field contains non-numeric value:', row.bed);
            bedId = 0; // This will cause validation error
          }
          
          return {
            culture: cultureId,
            bed: bedId,
            planting_date: plantingDate,
            quantity: row.quantity,
            area_usage_sqm: row.area_usage_sqm,
            notes: row.notes || '',
          };
        }}
        validateRow={(row) => {
          if (!row.planting_date) {
            return t('plantingPlans:validation.plantingDateRequired');
          }
          if (!row.culture || row.culture === 0) {
            return t('plantingPlans:validation.cultureRequired');
          }
          if (!row.bed || row.bed === 0) {
            return t('plantingPlans:validation.bedRequired');
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
