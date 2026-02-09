/**
 * Edit cell for plants_count field in PlantingPlans grid.
 * 
 * When user edits plant count, updates only the plants field during editing.
 * The partner area_m2 field is computed and updated after the edit is committed.
 * Uses culture spacing data to calculate area from plants.
 */

import { useState, useEffect } from 'react';
import { TextField } from '@mui/material';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { useGridApiContext } from '@mui/x-data-grid';
import type { Culture } from '../../api/types';

export interface PlantsCountEditCellProps extends GridRenderEditCellParams {
  cultures: Culture[];
  onLastEditedFieldChange: (field: 'plants_count') => void;
}

/**
 * Calculate plants per m² from culture spacing.
 * 
 * @param culture - Culture with spacing data
 * @returns plants per m² or null if spacing invalid
 */
function getPlantsPerM2(culture: Culture | undefined): number | null {
  if (!culture) return null;
  
  const rowSpacing = culture.row_spacing_m;
  const plantSpacing = culture.distance_within_row_m;
  
  if (!rowSpacing || !plantSpacing || rowSpacing <= 0 || plantSpacing <= 0) {
    return null;
  }
  
  // Formula: 1 / (row_spacing_m * distance_within_row_m)
  return 1 / (rowSpacing * plantSpacing);
}

/**
 * Calculate area from plants count and plants per m².
 * 
 * @param plantsCount - Number of plants
 * @param plantsPerM2 - Plants per square meter
 * @returns Area in m² or null
 */
function computeAreaM2(plantsCount: number | null, plantsPerM2: number | null): number | null {
  if (!plantsCount || !plantsPerM2) return null;
  return plantsCount / plantsPerM2;
}

export function PlantsCountEditCell(props: PlantsCountEditCellProps): React.ReactElement {
  const { id, value, field, cultures, onLastEditedFieldChange } = props;
  const apiRef = useGridApiContext();
  
  console.log('[DEBUG] PlantsCountEditCell mounted for row', id, 'with value:', value);
  
  // Get row to access culture
  const row = apiRef.current.getRow(id);
  const culture = cultures.find((c) => c.id === row?.culture);
  const plantsPerM2 = getPlantsPerM2(culture);
  
  // Local state for immediate UI feedback
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );
  
  // Update ONLY the plants_count field during editing (not area_m2)
  useEffect(() => {
    const numValue = inputValue === '' ? null : parseInt(inputValue, 10);
    
    console.log('[DEBUG] PlantsCountEditCell updating plants_count to:', numValue);
    
    // Update only our own field
    apiRef.current.setEditCellValue({
      id,
      field,
      value: numValue
    });
    
    // Calculate area for display in the grid (but don't update the edit cell)
    if (numValue !== null && !isNaN(numValue) && numValue > 0 && plantsPerM2) {
      const areaM2 = computeAreaM2(numValue, plantsPerM2);
      console.log('[DEBUG] PlantsCountEditCell calculated area_m2:', areaM2);
      // Update the row's area_m2 value so it displays correctly
      apiRef.current.setEditCellValue({
        id,
        field: 'area_m2',
        value: areaM2
      });
    }
  }, [inputValue, id, field, apiRef, plantsPerM2]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    console.log('[DEBUG] PlantsCountEditCell input changed to:', val);
    setInputValue(val);
    onLastEditedFieldChange('plants_count');
  };
  
  return (
    <TextField
      type="number"
      value={inputValue}
      onChange={handleChange}
      inputProps={{ min: 0, step: 1 }}
      size="small"
      fullWidth
      autoFocus
      sx={{ '& .MuiInputBase-root': { height: '100%' } }}
    />
  );
}
