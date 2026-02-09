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

export function AreaM2EditCell(props: AreaM2EditCellProps): React.ReactElement {
  const { id, value, field, onLastEditedFieldChange } = props;
  const apiRef = useGridApiContext();
  
  console.log('[DEBUG] AreaM2EditCell mounted for row', id, 'with value:', value);
  
  // Local state for immediate UI feedback
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );
  
  // Update ONLY the area_m2 field during editing (not plants_count)
  useEffect(() => {
    const numValue = inputValue === '' ? null : parseFloat(inputValue);
    
    console.log('[DEBUG] AreaM2EditCell updating area_m2 to:', numValue);
    
    // Update only our own field - partner field will be updated after save
    apiRef.current.setEditCellValue({
      id,
      field,
      value: numValue
    });
  }, [inputValue, id, field, apiRef]);
  
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
