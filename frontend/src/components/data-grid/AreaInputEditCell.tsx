/**
 * Area Input Edit Cell component for PlantingPlan grid.
 * 
 * Allows users to input area either as square meters (m²) or as number of plants.
 * Plants are converted to m² using culture spacing data.
 * 
 * @remarks
 * This component is used in the PlantingPlans data grid to provide a custom edit cell
 * for the area field that supports both m² and plant count inputs.
 */

import { useState, useEffect } from 'react';
import { Box, TextField, Select, MenuItem, FormControl, InputLabel, FormHelperText } from '@mui/material';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { useTranslation } from '../../i18n';
import type { Culture } from '../../api/types';

/**
 * Value stored in the cell during editing
 */
interface AreaInputValue {
  value: number | '';
  unit: 'M2' | 'PLANTS';
}

/**
 * Props for AreaInputEditCell component
 */
export interface AreaInputEditCellProps extends GridRenderEditCellParams {
  /** Array of all cultures for looking up spacing data */
  cultures: Culture[];
}

/**
 * Custom edit cell for area input with unit selection
 * 
 * @param props - Grid edit cell params plus cultures array
 * @returns Custom edit cell component
 */
export function AreaInputEditCell(props: AreaInputEditCellProps): React.ReactElement {
  const { id, value, field, api, cultures } = props;
  const { t } = useTranslation(['plantingPlans', 'common']);
  
  // Get the row data to access culture selection
  const row = api.getRow(id);
  const cultureId = row?.culture;
  const culture = cultures.find(c => c.id === cultureId);
  
  // Check if plants option is available
  const canUsePlants = culture && culture.plants_per_m2 !== null && culture.plants_per_m2 !== undefined && culture.plants_per_m2 > 0;
  
  // Parse current value or initialize
  const initialValue: AreaInputValue = typeof value === 'object' && value !== null && 'value' in value && 'unit' in value
    ? value as AreaInputValue
    : { value: (value as number) || '', unit: 'M2' };
  
  const [inputValue, setInputValue] = useState<number | ''>(initialValue.value);
  const [unit, setUnit] = useState<'M2' | 'PLANTS'>(initialValue.unit);
  
  // If plants option becomes unavailable, switch to M2
  useEffect(() => {
    if (unit === 'PLANTS' && !canUsePlants) {
      setUnit('M2');
    }
  }, [unit, canUsePlants]);
  
  // Update grid cell value whenever input changes
  useEffect(() => {
    api.setEditCellValue({ id, field, value: { value: inputValue, unit } });
  }, [inputValue, unit, api, id, field]);
  
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
          onChange={(e) => setUnit(e.target.value as 'M2' | 'PLANTS')}
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
