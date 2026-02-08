/**
 * Area Input Edit Cell component for PlantingPlan grid.
 * 
 * Allows users to input area either as square meters (m²) or as number of plants.
 * Plants are converted to m² using culture spacing data.
 * 
 * @remarks
 * This component maintains local edit state and communicates with parent via draft callbacks.
 * It does NOT modify the DataGrid row directly - the row always stores only numeric area_usage_sqm.
 */

import { useState, useEffect } from 'react';
import { Box, TextField, Select, MenuItem, FormControl, InputLabel, FormHelperText } from '@mui/material';
import type { GridRenderEditCellParams, GridRowId } from '@mui/x-data-grid';
import { useTranslation } from '../../i18n';
import type { Culture } from '../../api/types';

/**
 * Draft value stored during editing (outside DataGrid row)
 */
export interface AreaDraft {
  value: number | '';
  unit: 'M2' | 'PLANTS';
}

/**
 * Props for AreaInputEditCell component
 */
export interface AreaInputEditCellProps extends GridRenderEditCellParams {
  /** Array of all cultures for looking up spacing data */
  cultures: Culture[];
  /** Current draft for this row (if exists) */
  draft?: AreaDraft;
  /** Callback to update draft when local state changes */
  onDraftChange: (rowId: GridRowId, draft: AreaDraft) => void;
}

/**
 * Custom edit cell for area input with unit selection.
 * Maintains local state and updates parent draft, but does NOT modify grid row.
 * 
 * @param props - Grid edit cell params plus cultures array and draft callbacks
 * @returns Custom edit cell component
 */
export function AreaInputEditCell(props: AreaInputEditCellProps): React.ReactElement {
  const { id, value, field, api, cultures, draft, onDraftChange } = props;
  const { t } = useTranslation(['plantingPlans', 'common']);
  
  // Get the row data to access culture selection
  const row = api.getRow(id);
  const cultureId = row?.culture;
  const culture = cultures.find(c => c.id === cultureId);
  
  // Check if plants option is available
  const canUsePlants = culture && culture.plants_per_m2 !== null && culture.plants_per_m2 !== undefined && culture.plants_per_m2 > 0;
  
  // Initialize from draft (if exists) or from current numeric value
  const initialDraft: AreaDraft = draft || {
    value: (typeof value === 'number' && !isNaN(value)) ? value : '',
    unit: 'M2'
  };
  
  const [inputValue, setInputValue] = useState<number | ''>(initialDraft.value);
  const [unit, setUnit] = useState<'M2' | 'PLANTS'>(initialDraft.unit);
  
  // Update parent draft whenever local state changes
  useEffect(() => {
    onDraftChange(id, { value: inputValue, unit });
  }, [inputValue, unit, id, onDraftChange]);
  
  // If plants option becomes unavailable, switch to M2
  useEffect(() => {
    if (unit === 'PLANTS' && !canUsePlants) {
      setUnit('M2');
    }
  }, [unit, canUsePlants]);
  
  // Helper text for disabled plants option
  let helperText = '';
  if (unit === 'PLANTS' || !canUsePlants) {
    if (!cultureId || cultureId === 0) {
      helperText = t('plantingPlans:areaInput.noCulture');
    } else if (!canUsePlants) {
      helperText = t('plantingPlans:areaInput.noSpacing');
    }
  }
  
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', width: '100%', p: 1 }}>
      <TextField
        type="number"
        value={inputValue}
        onChange={(e) => {
          const newValue = e.target.value === '' ? '' : parseFloat(e.target.value);
          setInputValue(newValue);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            // Stop edit mode - draft is already updated via useEffect
            e.preventDefault();
            api.stopCellEditMode({ id, field });
          } else if (e.key === 'Escape') {
            // Cancel edit - discard draft
            api.stopCellEditMode({ id, field, ignoreModifications: true });
          }
        }}
        size="small"
        sx={{ flex: 1, minWidth: 80 }}
        inputProps={{
          min: 0,
          step: unit === 'PLANTS' ? 1 : 0.1,
        }}
        autoFocus
      />
      
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel id={`unit-select-label-${id}`}>{t('plantingPlans:areaInput.unit')}</InputLabel>
        <Select
          labelId={`unit-select-label-${id}`}
          value={unit}
          onChange={(e) => {
            const newUnit = e.target.value as 'M2' | 'PLANTS';
            setUnit(newUnit);
          }}
          label={t('plantingPlans:areaInput.unit')}
        >
          <MenuItem value="M2">{t('plantingPlans:areaInput.m2')}</MenuItem>
          <MenuItem value="PLANTS" disabled={!canUsePlants}>
            {t('plantingPlans:areaInput.plants')}
          </MenuItem>
        </Select>
        {helperText && (
          <FormHelperText error={!canUsePlants}>
            {helperText}
          </FormHelperText>
        )}
      </FormControl>
    </Box>
  );
}
