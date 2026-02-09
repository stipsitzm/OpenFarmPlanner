/**
 * Edit cell for plants_count field in PlantingPlans grid.
 * 
 * Manages local state for immediate UI feedback.
 * MUI DataGrid automatically extracts the value when edit mode ends.
 * The partner area_m2 field is computed after save via mapToRow.
 */

import { useState } from 'react';
import { TextField } from '@mui/material';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import type { Culture } from '../../api/types';

export interface PlantsCountEditCellProps extends GridRenderEditCellParams {
  cultures: Culture[];
  onLastEditedFieldChange: (field: 'plants_count') => void;
}

export function PlantsCountEditCell(props: PlantsCountEditCellProps): React.ReactElement {
  const { id, value, onLastEditedFieldChange } = props;
  
  console.log('[DEBUG] PlantsCountEditCell mounted for row', id, 'with value:', value);
  
  // Local state for immediate UI feedback
  // DataGrid extracts this value when edit mode ends
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );
  
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
