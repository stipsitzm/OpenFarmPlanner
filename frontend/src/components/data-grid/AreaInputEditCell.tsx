/**
 * Area Input Edit Cell component for PlantingPlan grid.
 * 
 * Allows users to input area either as square meters (m²) or as number of plants.
 * Plants are converted to m² using culture spacing data.
 * Immediately calculates and stores the m² value in the grid row.
 * 
 * @remarks
 * This component calculates m² immediately and stores it directly in the grid using setEditCellValue.
 * The grid row ALWAYS contains only the numeric area_usage_sqm value.
 */

import { useState, useEffect } from 'react';
import { Box, TextField, Select, MenuItem, FormControl, FormHelperText } from '@mui/material';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { useGridApiContext } from '@mui/x-data-grid';
import { useTranslation } from '../../i18n';
import type { Culture } from '../../api/types';

/**
 * Props for AreaInputEditCell component
 */
export interface AreaInputEditCellProps extends GridRenderEditCellParams {
  /** Array of all cultures for looking up spacing data */
  cultures: Culture[];
}

/**
 * Custom edit cell for area input with unit selection.
 * Calculates m² immediately and stores it in the grid row.
 * 
 * @param props - Grid edit cell params plus cultures array
 * @returns Custom edit cell component
 */
export function AreaInputEditCell(props: AreaInputEditCellProps): React.ReactElement {
  const { id, value, field, cultures } = props;
  const { t } = useTranslation(['plantingPlans', 'common']);
  const apiRef = useGridApiContext();
  
  // Get the row data to access culture selection
  const row = apiRef.current.getRow(id);
  const cultureId = row?.culture;
  const culture = cultures.find((c) => c.id === row?.culture);
  
  // Local state for UI
  const [inputValue, setInputValue] = useState<number | ''>(
    typeof value === 'number' && !isNaN(value) ? value : ''
  );
  const [unit, setUnit] = useState<'M2' | 'PLANTS'>('M2');
  
  // Check if culture has valid spacing for plant conversion
  const canUsePlants = culture && 
    culture.plants_per_m2 !== null && 
    culture.plants_per_m2 !== undefined && 
    culture.plants_per_m2 > 0;
  
  // Calculate and update grid value whenever input changes
  useEffect(() => {
    if (inputValue === '' || inputValue <= 0) {
      // Don't update for invalid values
      return;
    }
    
    let calculatedAreaM2: number;
    
    if (unit === 'M2') {
      // Direct m² input
      calculatedAreaM2 = inputValue;
    } else {
      // PLANTS - convert using culture spacing
      if (!canUsePlants) {
        // Shouldn't happen if UI is correct, but safety check
        return;
      }
      calculatedAreaM2 = inputValue / culture.plants_per_m2!;
    }
    
    // Immediately update the grid cell value with calculated m²
    apiRef.current.setEditCellValue({
      id,
      field,
      value: calculatedAreaM2
    });
  }, [inputValue, unit, id, field, apiRef, canUsePlants, culture]);
  
  return (
    <Box sx={{ display: 'flex', gap: 1, width: '100%', p: 1 }}>
      <TextField
        type="number"
        value={inputValue}
        onChange={(e) => {
          const val = e.target.value;
          setInputValue(val === '' ? '' : parseFloat(val));
        }}
        inputProps={{ min: 0, step: 0.01 }}
        size="small"
        sx={{ flex: 1, minWidth: 0 }}
        autoFocus
      />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={unit}
          onChange={(e) => setUnit(e.target.value as 'M2' | 'PLANTS')}
        >
          <MenuItem value="M2">{t('areaInput.m2', { ns: 'plantingPlans' })}</MenuItem>
          <MenuItem 
            value="PLANTS" 
            disabled={!canUsePlants}
          >
            {t('areaInput.plants', { ns: 'plantingPlans' })}
          </MenuItem>
        </Select>
        {!canUsePlants && unit === 'PLANTS' && (
          <FormHelperText error>
            {t('areaInput.noSpacing', { ns: 'plantingPlans' })}
          </FormHelperText>
        )}
        {!culture && (
          <FormHelperText>
            {t('areaInput.noCulture', { ns: 'plantingPlans' })}
          </FormHelperText>
        )}
      </FormControl>
    </Box>
  );
}

