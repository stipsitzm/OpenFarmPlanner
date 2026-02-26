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
import type { GridColDef, GridCellParams } from '@mui/x-data-grid';
import { Box, Button, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from '../i18n';
import { plantingPlanAPI, cultureAPI, bedAPI, type PlantingPlan, type Culture, type Bed } from '../api/api';
import { AreaM2EditCell } from '../components/data-grid/AreaM2EditCell';
import {
  EditableDataGrid,
  createSingleSelectColumn,
  type EditableRow,
  type DataGridAPI,
  type SearchableSelectOption,
  type EditableDataGridCommandApi,
} from '../components/data-grid';
import { useCommandContextTag, useRegisterCommands } from '../commands/CommandProvider';
import type { CommandSpec } from '../commands/types';

/**
 * Row data type for Data Grid
 */
interface PlantingPlanRow extends PlantingPlan, EditableRow {
  id: number;
  isNew?: boolean;
  area_m2?: number;
  plants_count?: number | null; // UI-only derived field
  note_attachment_count?: number;
}

const estimateColumnWidth = (values: string[], min: number, max: number): number => {
  const longest = values.reduce((length, value) => Math.max(length, value.length), 0);
  const estimated = longest * 8 + 52;
  return Math.max(min, Math.min(max, estimated));
};

const toIsoDateString = (value: unknown): string | null => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return null;
};


function PlantingPlans(): React.ReactElement {
  const { t } = useTranslation(['plantingPlans', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const urlParamProcessedRef = useRef<boolean>(false);
  const gridCommandApiRef = useRef<EditableDataGridCommandApi | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlantingPlanRow | null>(null);

  useCommandContextTag('plans');
  
  // Track which field was last edited (for determining API payload)
  const lastEditedFieldRef = useRef<'area_m2' | 'plants_count' | null>(null);

  const cultureOptions: SearchableSelectOption[] = useMemo(
    () => cultures
      .filter(c => c.id !== undefined)
      .map(c => ({
        value: c.id!,
        label: c.variety ? `${c.name} (${c.variety})` : c.name,
      })),
    [cultures]
  );

  const bedOptions: SearchableSelectOption[] = useMemo(
    () => beds
      .filter(b => b.id !== undefined)
      .map(b => {
        const baseName = b.field_name ? `${b.field_name} - ${b.name}` : b.name;
        const areaInfo = b.area_sqm ? ` (${b.area_sqm} m²)` : '';
        return { value: b.id!, label: `${baseName}${areaInfo}` };
      }),
    [beds]
  );

  const dynamicWidths = useMemo(() => {
    const cultureWidth = estimateColumnWidth(
      [t('plantingPlans:columns.culture'), ...cultureOptions.map((option) => option.label)],
      170,
      360,
    );
    const bedWidth = estimateColumnWidth(
      [t('plantingPlans:columns.bed'), ...bedOptions.map((option) => option.label)],
      220,
      460,
    );

    return {
      culture: cultureWidth,
      bed: bedWidth,
      plantingDate: 150,
      harvestDate: 150,
      harvestEndDate: 150,
      area: 280,
      plants: 130,
      notes: 260,
    };
  }, [bedOptions, cultureOptions, t]);

  /**
   * Check for cultureId or bedId parameter in URL and set as initial values
   */
  const [initialSelection] = useState(() => {
    const cultureIdParam = searchParams.get('cultureId');
    const bedIdParam = searchParams.get('bedId');
    let cultureId: number | null = null;
    let bedId: number | null = null;

    if (cultureIdParam) {
      const parsedCultureId = parseInt(cultureIdParam, 10);
      if (!isNaN(parsedCultureId)) {
        cultureId = parsedCultureId;
      }
    }

    if (bedIdParam) {
      const parsedBedId = parseInt(bedIdParam, 10);
      if (!isNaN(parsedBedId)) {
        bedId = parsedBedId;
      }
    }

    return { cultureId, bedId };
  });

  useEffect(() => {
    if (urlParamProcessedRef.current) {
      return;
    }

    const newParams = new URLSearchParams(searchParams);
    let hasChanges = false;

    if (initialSelection.cultureId !== null) {
      newParams.delete('cultureId');
      hasChanges = true;
    }

    if (initialSelection.bedId !== null) {
      newParams.delete('bedId');
      hasChanges = true;
    }

    if (hasChanges) {
      setSearchParams(newParams, { replace: true });
    }

    urlParamProcessedRef.current = true;
  }, [initialSelection, searchParams, setSearchParams]);

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
  const commands = useMemo<CommandSpec[]>(() => [
    {
      id: 'plans.create',
      title: 'Neuer Anbauplan (Alt+N)',
      keywords: ['anbauplan', 'neu', 'create'],
      shortcutHint: 'Alt+N',
      keys: { alt: true, key: 'n' },
      contextTags: ['plans'],
      isAvailable: () => Boolean(gridCommandApiRef.current),
      run: () => gridCommandApiRef.current?.addRow(),
    },
    {
      id: 'plans.edit',
      title: 'Anbauplan bearbeiten (Alt+E)',
      keywords: ['anbauplan', 'bearbeiten', 'edit'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['plans'],
      isAvailable: () => selectedPlan !== null,
      run: () => gridCommandApiRef.current?.editSelectedRow(),
    },
    {
      id: 'plans.delete',
      title: 'Anbauplan löschen (Alt+Shift+D)',
      keywords: ['anbauplan', 'löschen', 'delete'],
      shortcutHint: 'Alt+Shift+D',
      keys: { alt: true, shift: true, key: 'd' },
      contextTags: ['plans'],
      isAvailable: () => selectedPlan !== null,
      run: () => gridCommandApiRef.current?.deleteSelectedRow(),
    },
  ], [selectedPlan]);

  useRegisterCommands('plans-page', commands);

  const columns: GridColDef[] = useMemo(() => [
    createSingleSelectColumn<PlantingPlanRow>({
      field: 'culture',
      headerName: t('plantingPlans:columns.culture'),
      flex: 0,
      minWidth: dynamicWidths.culture,
      options: cultureOptions,
    }),
    {
      ...createSingleSelectColumn<PlantingPlanRow>({
        field: 'bed',
        headerName: t('plantingPlans:columns.bed'),
        flex: 0,
        minWidth: dynamicWidths.bed,
        options: bedOptions,
      }),
      valueSetter: (value, row) => {
        const nextRow = row as PlantingPlanRow;
        const numericValue = typeof value === 'number' ? value : Number(value);
        const selectedBed = beds.find((bed) => bed.id === numericValue);
        const isNewRow = Boolean(nextRow.isNew);
        const currentArea = nextRow.area_m2;
        const shouldAutofill = isNewRow && (currentArea === undefined || currentArea === null);

        return {
          ...nextRow,
          bed: numericValue,
          area_m2: shouldAutofill && selectedBed?.area_sqm !== undefined
            ? selectedBed.area_sqm
            : currentArea,
        } as PlantingPlanRow;
      },
    },
    {
      field: 'planting_date',
      headerName: t('plantingPlans:columns.plantingDate'),
      flex: 0,
      minWidth: dynamicWidths.plantingDate,
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
      flex: 0,
      minWidth: dynamicWidths.harvestDate,
      editable: false,
      type: 'date',
      valueGetter: (value) => value ? new Date(value) : null,
    },
    {
      field: 'harvest_end_date',
      headerName: t('plantingPlans:columns.harvestEndDate'),
      flex: 0,
      minWidth: dynamicWidths.harvestEndDate,
      editable: false,
      type: 'date',
      valueGetter: (value) => value ? new Date(value) : null,
    },
    {
      field: 'area_m2',
      headerName: t('plantingPlans:columns.areaM2'),
      flex: 0,
      minWidth: dynamicWidths.area,
      editable: true,
      type: 'number',
      renderHeader: () => (
        <Tooltip title={t('plantingPlans:tooltips.coupledFields')}>
            <div>{t('plantingPlans:columns.areaM2')}</div>
        </Tooltip>
      ),
      preProcessEditCellProps: (params) => {
        if (params.hasChanged) {
          lastEditedFieldRef.current = 'area_m2';
        }
        const bed = beds.find((item) => item.id === (params.row as PlantingPlanRow).bed);
        const bedArea = bed?.area_sqm;
        const numericValue = Number(params.props.value);
        const hasAreaError =
          bedArea !== undefined
          && bedArea !== null
          && Number.isFinite(numericValue)
          && numericValue > bedArea;
        return { ...params.props, error: hasAreaError };
      },
      renderEditCell: (params) => {
        const row = params.row as PlantingPlanRow;
        const selectedBed = beds.find((item) => item.id === row.bed);

        return (
          <AreaM2EditCell
            {...params}
            bedAreaSqm={selectedBed?.area_sqm}
            onLastEditedFieldChange={() => {
              lastEditedFieldRef.current = 'area_m2';
            }}
            onApplyRest={async () => {
              const bedId = typeof row.bed === 'number' ? row.bed : Number(row.bed);
              const startDate = toIsoDateString(row.planting_date);
              const endDate =
                toIsoDateString(row.harvest_end_date)
                ?? toIsoDateString(row.harvest_date)
                ?? startDate;

              if (!bedId || !startDate || !endDate) {
                return null;
              }

              const params = {
                bed_id: bedId,
                start_date: startDate,
                end_date: endDate,
                ...(row.id > 0 ? { exclude_plan_id: row.id } : {}),
              };

              const response = await plantingPlanAPI.remainingArea(params);
              return response.data.remaining_area_sqm;
            }}
          />
        );
      },
      valueFormatter: (value) => {
        const numericValue = Number(value);
        if (!Number.isNaN(numericValue)) {
          return `${numericValue.toFixed(2)} m²`;
        }
        return '';
      },
      headerClassName: 'coupled-field-header',
    },
    {
      field: 'plants_count',
      headerName: t('plantingPlans:columns.plantsCount'),
      flex: 0,
      minWidth: dynamicWidths.plants,
      editable: true,
      type: 'number',
      renderHeader: () => (
        <Tooltip title={t('plantingPlans:tooltips.plantsFromSpacing')}>
            <div>{t('plantingPlans:columns.plantsCount')}</div>
        </Tooltip>
      ),
      preProcessEditCellProps: (params) => {
        if (params.hasChanged) {
          lastEditedFieldRef.current = 'plants_count';
        }
        return params.props;
      },
      valueFormatter: (value) => {
        if (typeof value === 'number' && !isNaN(value)) {
          return `≈ ${Math.round(value)}`;
        }
        return '—';
      },
      // Disable editing if culture has no valid spacing
      isCellEditable: (params: GridCellParams<PlantingPlanRow>) => {
        const row = params.row as PlantingPlanRow;
        const culture = cultures.find(c => c.id === row.culture);
        if (!culture) return false;
        const plantsPerM2 = culture.plants_per_m2;
        return plantsPerM2 !== null && plantsPerM2 !== undefined && plantsPerM2 > 0;
      },
      headerClassName: 'coupled-field-header',
    },
    {
      field: 'notes',
      headerName: t('common:fields.notes'),
      width: dynamicWidths.notes,
      // Notes field will be overridden by NotesCell in EditableDataGrid
    },
  ], [bedOptions, beds, cultureOptions, cultures, dynamicWidths, t]);

  return (
    <div className="page-container" style={{ maxWidth: 'none', margin: 0, paddingLeft: 16, paddingRight: 16 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h1>{t('plantingPlans:title')}</h1>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => gridCommandApiRef.current?.addRow()}
          aria-label={`${t('plantingPlans:addButton')} (Alt+N)`}
        >
          {t('plantingPlans:addButton')}
        </Button>
      </Box>
      
      <EditableDataGrid<PlantingPlanRow>
        columns={columns}
        api={plantingPlanAPI as unknown as DataGridAPI<PlantingPlanRow>}
        commandApiRef={gridCommandApiRef}
        onSelectedRowChange={setSelectedPlan}
        createNewRow={() => ({
          id: -Date.now(),
          culture: 0,
          bed: 0,
          planting_date: '',
          quantity: undefined,
          area_m2: undefined,
          plants_count: undefined,
          notes: '',
          note_attachment_count: 0,
          isNew: true,
        })}
        initialRow={
          initialSelection.cultureId || initialSelection.bedId
            ? {
                ...(initialSelection.cultureId ? { culture: initialSelection.cultureId } : {}),
                ...(initialSelection.bedId ? { bed: initialSelection.bedId } : {}),
              }
            : undefined
        }
        mapToRow={(plan) => {
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
            // plants_count computed by backend serializer
            plants_count: plan.plants_count ?? null,
            notes: plan.notes || '',
            note_attachment_count: plan.note_attachment_count ?? 0,
          };
        }}
        mapToApiData={(row) => {
          console.log('[DEBUG] mapToApiData called with row:', row);
          console.log('[DEBUG] mapToApiData lastEditedField:', lastEditedFieldRef.current);
          
          const plantingDate = toIsoDateString(row.planting_date) ?? '';
          
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
          const apiData: Partial<PlantingPlanRow> = {
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

          const selectedBed = beds.find((bed) => bed.id === row.bed);
          if (
            selectedBed?.area_sqm !== undefined
            && selectedBed.area_sqm !== null
            && typeof row.area_m2 === 'number'
            && row.area_m2 > selectedBed.area_sqm
          ) {
            return 'Fläche darf die Beetfläche nicht überschreiten.';
          }
          
          return null;
        }}
        loadErrorMessage={t('plantingPlans:errors.load')}
        saveErrorMessage={t('plantingPlans:errors.save')}
        deleteErrorMessage={t('plantingPlans:errors.delete')}
        deleteConfirmMessage={t('plantingPlans:confirmDelete')}
        addButtonLabel={`${t('plantingPlans:addButton')} (Alt+N)`}
        showDeleteAction={true}
        tableKey="plantingPlans"
        defaultSortModel={[{ field: 'planting_date', sort: 'asc' }]}
        persistSortInUrl={true}
        notes={{
          fields: [
            {
              field: 'notes',
              labelKey: 'common:fields.notes',
              attachmentNoteIdField: 'id',
              attachmentCountField: 'note_attachment_count',
            },
          ],
        }}
      />
    </div>
  );
}

export default PlantingPlans;
