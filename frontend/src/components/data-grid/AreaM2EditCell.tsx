/**
 * Edit cell for area_m2 field in PlantingPlans grid.
 *
 * Provides a numeric input with quick action buttons for Max and Rest values.
 */

import { useMemo, useState } from 'react';
import { Box, Button, TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';

export interface AreaM2EditCellProps extends GridRenderEditCellParams {
  bedAreaSqm?: number;
  onLastEditedFieldChange: (field: 'area_m2') => void;
  onApplyRest: () => Promise<number | null>;
}

export function AreaM2EditCell(props: AreaM2EditCellProps): React.ReactElement {
  const { id, value, field, hasFocus, bedAreaSqm, onLastEditedFieldChange, onApplyRest } = props;
  const apiRef = useGridApiContext();
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !Number.isNaN(value) ? value.toString() : ''
  );
  const [isLoadingRest, setIsLoadingRest] = useState<boolean>(false);

  const maxDisabled = bedAreaSqm === undefined || bedAreaSqm === null;

  const areaExceeded = useMemo(() => {
    const parsed = Number.parseFloat(inputValue);
    if (Number.isNaN(parsed) || maxDisabled) {
      return false;
    }
    return parsed > (bedAreaSqm ?? 0);
  }, [inputValue, maxDisabled, bedAreaSqm]);

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

  const handleMaxClick = async (): Promise<void> => {
    if (maxDisabled) {
      return;
    }
    const maxValue = Number(bedAreaSqm);
    setInputValue(maxValue.toString());
    await applyValue(maxValue);
  };

  const handleRestClick = async (): Promise<void> => {
    setIsLoadingRest(true);
    try {
      const restValue = await onApplyRest();
      if (restValue === null) {
        return;
      }
      setInputValue(restValue.toString());
      await applyValue(restValue);
    } finally {
      setIsLoadingRest(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
        minWidth: 260,
      }}
    >
      <TextField
        type="number"
        autoFocus={hasFocus}
        value={inputValue}
        onChange={handleChange}
        size="small"
        error={areaExceeded}
        helperText={areaExceeded ? 'Überschreitet Beetfläche' : ''}
        slotProps={{
          htmlInput: {
            min: 0,
            step: 0.01,
            tabIndex: hasFocus ? 0 : -1,
          },
        }}
        sx={{ minWidth: 110, flex: 1 }}
      />
      <Button size="small" variant="outlined" onClick={handleMaxClick} disabled={maxDisabled} tabIndex={-1}>
        Max
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={handleRestClick}
        disabled={isLoadingRest || maxDisabled}
        tabIndex={-1}
      >
        Rest
      </Button>
    </Box>
  );
}
