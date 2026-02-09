/**
 * Planting Plans (Anbaupläne) page component.
 * 
 * Manages planting schedules with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Planting Plans page component
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GridColDef } from '@mui/x-data-grid';
import { Typography, Tooltip } from '@mui/material';
import { useTranslation } from '../i18n';
import { plantingPlanAPI, cultureAPI, bedAPI, type PlantingPlan, type Culture, type Bed } from '../api/api';
import { EditableDataGrid, type EditableRow, type DataGridAPI } from '../components/data-grid';
import { AreaM2EditCell } from '../components/data-grid/AreaM2EditCell';
import { PlantsCountEditCell } from '../components/data-grid/PlantsCountEditCell';

/**
 * Row data type for Data Grid
 */
interface PlantingPlanRow extends PlantingPlan, EditableRow {
  id: number;
  isNew?: boolean;
  plants_count?: number | null; // UI-only derived field
}

function PlantingPlans(): React.ReactElement {
  const { t } = useTranslation(['plantingPlans', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [initialCultureId, setInitialCultureId] = useState<number | null>(null);
  const [initialBedId, setInitialBedId] = useState<number | null>(null);
  const urlParamProcessedRef = useRef<boolean>(false);
  
  // Track which field was last edited (for determining API payload)
  const lastEditedFieldRef = useRef<'area_m2' | 'plants_count' | null>(null);

  /**
   * Helper: Get culture for a row
   */
  const getCultureForRow = (row: PlantingPlanRow): Culture | undefined => {
    return cultures.find((c) => c.id === row.culture);
  };

  /**
   * Helper: Calculate plants per m² from culture spacing
   */
  const getPlantsPerM2 = (culture: Culture | undefined): number | null => {
    if (!culture) return null;
    
    const rowSpacing = culture.row_spacing_m;
    const plantSpacing = culture.distance_within_row_m;
    
    if (!rowSpacing || !plantSpacing || rowSpacing <= 0 || plantSpacing <= 0) {
      return null;
    }
    
    // Formula: 1 / (row_spacing_m * distance_within_row_m)
    return 1 / (rowSpacing * plantSpacing);
  };

  /**
   * Helper: Calculate plants count from area and plants per m²
   */
  const computePlantsCount = (areaM2: number | null, plantsPerM2: number | null): number | null => {
    if (!areaM2 || !plantsPerM2 || areaM2 <= 0) return null;
    return Math.round(areaM2 * plantsPerM2);
  };

  /**
   * Helper: Calculate area from plants count and plants per m²
   */
  const computeAreaM2 = (plantsCount: number | null, plantsPerM2: number | null): number | null => {
    if (!plantsCount || !plantsPerM2 || plantsCount <= 0) return null;
    return plantsCount / plantsPerM2;
  };

  /**
   * Check for cultureId or bedId parameter in URL and set as initial values
   */
  useEffect(() => {
    if (!urlParamProcessedRef.current) {
      const newParams = new URLSearchParams(searchParams);
      let hasChanges = false;

      const cultureIdParam = searchParams.get('cultureId');
      if (cultureIdParam) {
        const cultureId = parseInt(cultureIdParam, 10);
        if (!isNaN(cultureId)) {
          setInitialCultureId(cultureId);
          newParams.delete('cultureId');
          hasChanges = true;
        }
      }

      const bedIdParam = searchParams.get('bedId');
      if (bedIdParam) {
        const bedId = parseInt(bedIdParam, 10);
        if (!isNaN(bedId)) {
          setInitialBedId(bedId);
          newParams.delete('bedId');
          hasChanges = true;
        }
      }

      // Remove parameters from URL after reading them
      if (hasChanges) {
        setSearchParams(newParams, { replace: true });
      }

      urlParamProcessedRef.current = true;
    }
  }, [searchParams, setSearchParams]);

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
      field: 'area_m2',
      headerName: t('plantingPlans:columns.areaM2'),
      flex: 0.7,
      minWidth: 140,
      editable: true,
      type: 'number',
      renderHeader: () => (
        <Tooltip title={t('plantingPlans:tooltips.coupledFields')}>
          <div>
            <div>{t('plantingPlans:columns.areaM2')}</div>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              ↔ {t('plantingPlans:labels.coupled')}
            </Typography>
          </div>
        </Tooltip>
      ),
      renderEditCell: (params) => (
        <AreaM2EditCell 
          {...params} 
          cultures={cultures}
          onLastEditedFieldChange={(field) => {
            lastEditedFieldRef.current = field;
          }}
        />
      ),
      valueFormatter: (value) => {
        if (typeof value === 'number' && !isNaN(value)) {
          return `${value.toFixed(2)} m²`;
        }
        return '';
      },
      headerClassName: 'coupled-field-header',
    },
    {
      field: 'plants_count',
      headerName: t('plantingPlans:columns.plantsCount'),
      flex: 0.7,
      minWidth: 140,
      editable: true,
      type: 'number',
      renderHeader: () => (
        <Tooltip title={t('plantingPlans:tooltips.plantsFromSpacing')}>
          <div>
            <div>{t('plantingPlans:columns.plantsCount')}</div>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
              ↔ {t('plantingPlans:labels.coupled')}
            </Typography>
          </div>
        </Tooltip>
      ),
      renderEditCell: (params) => (
        <PlantsCountEditCell 
          {...params} 
          cultures={cultures}
          onLastEditedFieldChange={(field) => {
            lastEditedFieldRef.current = field;
          }}
        />
      ),
      valueFormatter: (value) => {
        if (typeof value === 'number' && !isNaN(value)) {
          return `≈ ${Math.round(value)}`;
        }
        return '—';
      },
      // Disable editing if culture has no valid spacing
      editable: true,
      isCellEditable: (params) => {
        const row = params.row as PlantingPlanRow;
        const culture = getCultureForRow(row);
        const plantsPerM2 = getPlantsPerM2(culture);
        return plantsPerM2 !== null;
      },
      headerClassName: 'coupled-field-header',
    },
    {
      field: 'notes',
      headerName: t('common:fields.notes'),
      width: 250,
      // Notes field will be overridden by NotesCell in EditableDataGrid
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
          area_m2: undefined,
          plants_count: undefined,
          notes: '',
          isNew: true,
        })}
        initialRow={
          initialCultureId || initialBedId
            ? {
                ...(initialCultureId ? { culture: initialCultureId } : {}),
                ...(initialBedId ? { bed: initialBedId } : {}),
              }
            : undefined
        }
        mapToRow={(plan) => {
          // Get culture to compute plants_count
          const culture = cultures.find(c => c.id === plan.culture);
          const plantsPerM2 = getPlantsPerM2(culture);
          const plantsCount = computePlantsCount(plan.area_usage_sqm ?? null, plantsPerM2);
          
          return {
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
            // Backend field name is area_usage_sqm, map to area_m2 for grid
            area_m2: plan.area_usage_sqm,
            // Compute plants_count from area and culture spacing
            plants_count: plantsCount,
            notes: plan.notes || '',
          };
        }}
        mapToApiData={(row) => {
          console.log('[DEBUG] mapToApiData called with row:', row);
          console.log('[DEBUG] mapToApiData lastEditedField:', lastEditedFieldRef.current);
          
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
          
          // Prepare API data object
          const apiData: PlantingPlan = {
            culture: cultureId,
            bed: bedId,
            planting_date: plantingDate,
            quantity: row.quantity,
            notes: row.notes || '',
          };
          
          // Determine which field to send based on last edit
          const source = lastEditedFieldRef.current || 'area_m2';
          
          console.log('[DEBUG] mapToApiData source:', source);
          console.log('[DEBUG] mapToApiData row.area_m2:', row.area_m2);
          console.log('[DEBUG] mapToApiData row.plants_count:', row.plants_count);
          
          if (source === 'area_m2' && typeof row.area_m2 === 'number') {
            // User edited area directly - send as M2
            apiData.area_input_value = row.area_m2;
            apiData.area_input_unit = 'M2';
            console.log('[DEBUG] mapToApiData sending area as M2:', apiData.area_input_value);
          } else if (source === 'plants_count' && typeof row.plants_count === 'number') {
            // User edited plants count - send as PLANTS
            apiData.area_input_value = row.plants_count;
            apiData.area_input_unit = 'PLANTS';
            console.log('[DEBUG] mapToApiData sending plants count as PLANTS:', apiData.area_input_value);
          }
          
          // Clear last edited field after use
          lastEditedFieldRef.current = null;
          
          console.log('[DEBUG] mapToApiData final payload:', apiData);
          return apiData;
        }}
        validateRow={(row) => {
          const missingFields: string[] = [];
          
          if (!row.planting_date) {
            missingFields.push(t('plantingPlans:columns.plantingDate'));
          }
          if (!row.culture || row.culture === 0) {
            missingFields.push(t('plantingPlans:columns.culture'));
          }
          if (!row.bed || row.bed === 0) {
            missingFields.push(t('plantingPlans:columns.bed'));
          }
          
          if (missingFields.length > 0) {
            return t('plantingPlans:validation.requiredFields', { 
              fields: missingFields.join(', ') 
            });
          }
          
          return null;
        }}
        loadErrorMessage={t('plantingPlans:errors.load')}
        saveErrorMessage={t('plantingPlans:errors.save')}
        deleteErrorMessage={t('plantingPlans:errors.delete')}
        deleteConfirmMessage={t('plantingPlans:confirmDelete')}
        addButtonLabel={t('plantingPlans:addButton')}
        showDeleteAction={true}
        notes={{
          fields: [
            {
              field: 'notes',
              labelKey: 'common:fields.notes',
            },
          ],
        }}
      />
    </div>
  );
}

export default PlantingPlans;
