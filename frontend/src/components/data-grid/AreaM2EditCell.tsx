/**
 * Edit cell for area_m2 field in PlantingPlans grid.
 * 
 * When user edits area, updates only the area field during editing.
 * The partner plants_count field is computed and updated after the edit is committed.
 * Uses culture spacing data to calculate plants from area.
 */

import { useState, useEffect } from 'react';
import { TextField } from '@mui/material';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { useGridApiContext } from '@mui/x-data-grid';
import type { Culture } from '../../api/types';

export interface AreaM2EditCellProps extends GridRenderEditCellParams {
  cultures: Culture[];
  onLastEditedFieldChange: (field: 'area_m2') => void;
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
 * Calculate plants count from area and plants per m².
 * 
 * @param areaM2 - Area in square meters
 * @param plantsPerM2 - Plants per square meter
 * @returns Rounded plants count or null
 */
function computePlantsCount(areaM2: number | null, plantsPerM2: number | null): number | null {
  if (!areaM2 || !plantsPerM2) return null;
  return Math.round(areaM2 * plantsPerM2);
}

export function AreaM2EditCell(props: AreaM2EditCellProps): React.ReactElement {
  const { id, value, field, cultures, onLastEditedFieldChange } = props;
  const apiRef = useGridApiContext();
  
  console.log('[DEBUG] AreaM2EditCell mounted for row', id, 'with value:', value);
  
  // Get row to access culture
  const row = apiRef.current.getRow(id);
  const culture = cultures.find((c) => c.id === row?.culture);
  const plantsPerM2 = getPlantsPerM2(culture);
  
  // Local state for immediate UI feedback
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );
  
  // Update ONLY the area_m2 field during editing (not plants_count)
  useEffect(() => {
    const numValue = inputValue === '' ? null : parseFloat(inputValue);
    
    console.log('[DEBUG] AreaM2EditCell updating area_m2 to:', numValue);
    
    // Update only our own field
    apiRef.current.setEditCellValue({
      id,
      field,
      value: numValue
    });
    
    // Calculate plants for display in the grid (but don't update the edit cell)
    if (numValue !== null && !isNaN(numValue) && numValue > 0 && plantsPerM2) {
      const plantsCount = computePlantsCount(numValue, plantsPerM2);
      console.log('[DEBUG] AreaM2EditCell calculated plants_count:', plantsCount);
      // Update the row's plants_count value so it displays correctly
      apiRef.current.setEditCellValue({
        id,
        field: 'plants_count',
        value: plantsCount
      });
    }
  }, [inputValue, id, field, apiRef, plantsPerM2]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    console.log('[DEBUG] AreaM2EditCell input changed to:', val);
    setInputValue(val);
    onLastEditedFieldChange('area_m2');
  };
  
  return (
    <TextField
      type="number"
      value={inputValue}
      onChange={handleChange}
      inputProps={{ min: 0, step: 0.01 }}
      size="small"
      fullWidth
      autoFocus
      sx={{ '& .MuiInputBase-root': { height: '100%' } }}
    />
  );
}
