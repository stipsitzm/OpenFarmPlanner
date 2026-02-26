/**
 * Edit cell for area_m2 field in PlantingPlans grid.
 *
 * Provides a numeric input for area editing with optional normalization on blur.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';

export interface AreaM2EditCellProps extends GridRenderEditCellParams {
  bedAreaSqm?: number;
  onLastEditedFieldChange: (field: 'area_m2') => void;
  normalizeAreaOnBlur?: (value: number | null) => Promise<number | null>;
}

export function AreaM2EditCell(props: AreaM2EditCellProps): React.ReactElement {
  const {
    id,
    value,
    field,
    hasFocus,
    bedAreaSqm,
    onLastEditedFieldChange,
    normalizeAreaOnBlur,
  } = props;
  const apiRef = useGridApiContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !Number.isNaN(value) ? value.toString() : ''
  );

  const maxDisabled = bedAreaSqm === undefined || bedAreaSqm === null;

  const areaExceeded = useMemo(() => {
    const parsed = Number.parseFloat(inputValue);
    if (Number.isNaN(parsed) || maxDisabled) {
      return false;
    }
    return parsed > (bedAreaSqm ?? 0);
  }, [inputValue, maxDisabled, bedAreaSqm]);

  useEffect(() => {
    if (hasFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [hasFocus]);

  const applyValue = async (nextValue: number | null): Promise<void> => {
    onLastEditedFieldChange('area_m2');
    await apiRef.current.setEditCellValue({
      id,
      field,
      value: nextValue,
    });
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const val = e.target.value;
    setInputValue(val);
    const numValue = val === '' ? null : Number.parseFloat(val);
    await applyValue(Number.isNaN(numValue as number) ? null : numValue);
  };

  const handleBlur = async (): Promise<void> => {
    if (!normalizeAreaOnBlur) {
      return;
    }
    const parsedValue = inputValue === '' ? null : Number.parseFloat(inputValue);
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      return;
    }
    const normalized = await normalizeAreaOnBlur(parsedValue);
    if (normalized !== parsedValue) {
      setInputValue(normalized === null ? '' : normalized.toString());
      await applyValue(normalized);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <TextField
        type="number"
        inputRef={inputRef}
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        size="small"
        error={areaExceeded}
        slotProps={{
          htmlInput: {
            min: 0,
            step: 0.01,
          },
        }}
        sx={{ minWidth: 96, flex: 1 }}
      />
    </Box>
  );
}
