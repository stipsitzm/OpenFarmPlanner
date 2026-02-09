/**
 * Edit cell for area_m2 field in PlantingPlans grid.
 * 
 * Manages local state for immediate UI feedback.
 * MUI DataGrid automatically extracts the value when edit mode ends.
 * The partner plants_count field is computed after save via mapToRow.
 */

import { useState } from 'react';
import { TextField } from '@mui/material';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import type { Culture } from '../../api/types';

export interface AreaM2EditCellProps extends GridRenderEditCellParams {
  cultures: Culture[];
  onLastEditedFieldChange: (field: 'area_m2') => void;
}

export function AreaM2EditCell(props: AreaM2EditCellProps): React.ReactElement {
  const { id, value, onLastEditedFieldChange } = props;
  
  console.log('[DEBUG] AreaM2EditCell mounted for row', id, 'with value:', value);
  
  // Local state for immediate UI feedback
  // DataGrid extracts this value when edit mode ends
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );
  
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
