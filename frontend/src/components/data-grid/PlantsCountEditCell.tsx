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

export function PlantsCountEditCell(props: PlantsCountEditCellProps): React.ReactElement {
  const { id, value, field, onLastEditedFieldChange } = props;
  const apiRef = useGridApiContext();
  
  console.log('[DEBUG] PlantsCountEditCell mounted for row', id, 'with value:', value);
  
  // Local state for immediate UI feedback
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );
  
  // Update ONLY the plants_count field during editing (not area_m2)
  useEffect(() => {
    const numValue = inputValue === '' ? null : parseInt(inputValue, 10);
    
    console.log('[DEBUG] PlantsCountEditCell updating plants_count to:', numValue);
    
    // Update only our own field - partner field will be updated after save
    apiRef.current.setEditCellValue({
      id,
      field,
      value: numValue
    });
  }, [inputValue, id, field, apiRef]);
  
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
