/**
 * Edit cell for plants_count field in PlantingPlans grid.
 * 
 * Manages local state for immediate UI feedback and communicates
 * value changes to DataGrid via setEditCellValue in onChange handler.
 * The partner area_m2 field is computed after save via mapToRow.
 */

import { useState } from 'react';
import { TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
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
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    console.log('[DEBUG] PlantsCountEditCell input changed to:', val);
    setInputValue(val);
    
    // Immediately update DataGrid with the new value
    const numValue = val === '' ? null : parseInt(val);
    console.log('[DEBUG] PlantsCountEditCell calling setEditCellValue with:', numValue);
    apiRef.current.setEditCellValue({
      id,
      field,
      value: numValue
    });
    
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
