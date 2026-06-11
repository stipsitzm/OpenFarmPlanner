/**
 * Edit cell for plants_count field in PlantingPlans grid.
 * 
 * Keeps raw input text during editing and lets the save flow normalize it.
 */

import { useEffect, useRef, useState } from 'react';
import { TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import type { Culture } from '../../api/types';

export interface PlantsCountEditCellProps extends GridRenderEditCellParams {
  cultures: Culture[];
  onLastEditedFieldChange: (field: 'plants_count') => void;
}

export function PlantsCountEditCell(props: PlantsCountEditCellProps) {
  const { id, value, field, hasFocus, onLastEditedFieldChange } = props;
  const apiRef = useGridApiContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );

  useEffect(() => {
    if (hasFocus) {
      return;
    }
    setInputValue(typeof value === 'number' && !isNaN(value) ? value.toString() : typeof value === 'string' ? value : '');
  }, [hasFocus, value]);

  useEffect(() => {
    if (hasFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [hasFocus]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    void apiRef.current.setEditCellValue({
      id,
      field,
      value: val
    });
    
    onLastEditedFieldChange('plants_count');
  };
  
  return (
    <TextField
      type="text"
      inputMode="numeric"
      inputRef={inputRef}
      value={inputValue}
      onChange={handleChange}
      slotProps={{
        htmlInput: {
          min: 0,
          step: 1,
          tabIndex: hasFocus ? 0 : -1,
        },
      }}
      size="small"
      fullWidth
      sx={{ '& .MuiInputBase-root': { height: '100%' } }}
    />
  );
}
