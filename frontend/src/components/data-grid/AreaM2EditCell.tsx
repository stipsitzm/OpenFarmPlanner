/**
 * Edit cell for area_m2 field in PlantingPlans grid.
 * 
 * Manages local state for immediate UI feedback and communicates
 * value changes to DataGrid via setEditCellValue in onChange handler.
 * The partner plants_count field is computed after save via mapToRow.
 */

import { useState, useRef } from 'react';
import { TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import type { Culture } from '../../api/types';

export interface AreaM2EditCellProps extends GridRenderEditCellParams {
  cultures: Culture[];
  onLastEditedFieldChange: (field: 'area_m2') => void;
}

export function AreaM2EditCell(props: AreaM2EditCellProps): React.ReactElement {
  const { id, value, field, onLastEditedFieldChange } = props;
  const apiRef = useGridApiContext();
  
  console.log('[DEBUG] AreaM2EditCell mounted for row', id, 'with value:', value);
  
  // Track initial value to prevent premature updates that steal focus
  const initialValueRef = useRef(value);
  
  // Local state for immediate UI feedback
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    console.log('[DEBUG] AreaM2EditCell input changed to:', val);
    setInputValue(val);
    
    // Immediately update DataGrid with the new value
    const numValue = val === '' ? null : parseFloat(val);
    
    // Only call setEditCellValue if value actually changed from initial
    // This prevents premature grid updates on mount that can steal focus
    if (numValue !== initialValueRef.current) {
      console.log('[DEBUG] AreaM2EditCell calling setEditCellValue with:', numValue);
      apiRef.current.setEditCellValue({
        id,
        field,
        value: numValue
      });
    }
    
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
