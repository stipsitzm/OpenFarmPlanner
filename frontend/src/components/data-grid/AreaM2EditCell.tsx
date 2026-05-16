/**
 * Edit cell for area_m2 field in PlantingPlans grid.
 *
 * Provides a numeric input for area editing with optional normalization on blur.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { formatLocalizedNumber, parseLocalizedNumber } from '../../utils/numberLocalization';

export interface AreaM2EditCellProps extends GridRenderEditCellParams {
  bedAreaSqm?: number;
  onLastEditedFieldChange: (field: 'area_m2') => void;
  getAvailableAreaOnBlur?: (value: number | null) => Promise<number | null>;
  fallbackValue?: number | null;
  formatArea: (value: number) => string;
  areaExceededMessage: string;
  availableAreaLabel: string;
  applyAvailableAreaLabel: string;
  locale: string;
}

export function AreaM2EditCell(props: AreaM2EditCellProps): React.ReactElement {
  const {
    id,
    value,
    field,
    hasFocus,
    bedAreaSqm,
    onLastEditedFieldChange,
    getAvailableAreaOnBlur,
    fallbackValue,
    formatArea,
    areaExceededMessage,
    availableAreaLabel,
    applyAvailableAreaLabel,
    locale,
  } = props;
  const apiRef = useGridApiContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalizedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : null;
  const [inputValue, setInputValue] = useState<string>(
    typeof normalizedValue === 'number' && !Number.isNaN(normalizedValue)
      ? formatLocalizedNumber(normalizedValue, locale, {
          useGrouping: false,
          maximumFractionDigits: 2,
        })
      : typeof fallbackValue === 'number' && !Number.isNaN(fallbackValue)
        ? formatLocalizedNumber(fallbackValue, locale, {
            useGrouping: false,
            maximumFractionDigits: 2,
          })
        : ''
  );
  const [availableArea, setAvailableArea] = useState<number | null>(null);
  const [showAvailableAreaError, setShowAvailableAreaError] = useState(false);

  const maxDisabled = bedAreaSqm === undefined || bedAreaSqm === null;

  const areaExceeded = useMemo(() => {
    const parsed = parseLocalizedNumber(inputValue, locale);
    if (parsed === null || maxDisabled) {
      return false;
    }
    return parsed > (bedAreaSqm ?? 0);
  }, [inputValue, locale, maxDisabled, bedAreaSqm]);

  useEffect(() => {
    if (hasFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [hasFocus]);

  useEffect(() => {
    if (typeof normalizedValue === 'number' && !Number.isNaN(normalizedValue)) {
      setInputValue(
        formatLocalizedNumber(normalizedValue, locale, {
          useGrouping: false,
          maximumFractionDigits: 2,
        })
      );
      return;
    }
    if (typeof fallbackValue === 'number' && !Number.isNaN(fallbackValue)) {
      setInputValue(
        formatLocalizedNumber(fallbackValue, locale, {
          useGrouping: false,
          maximumFractionDigits: 2,
        })
      );
      return;
    }
    setInputValue('');
  }, [normalizedValue, fallbackValue, locale]);

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
    setAvailableArea(null);
    setShowAvailableAreaError(false);
    const parsedValue = parseLocalizedNumber(val, locale);
    await applyValue(parsedValue);
  };

  const handleBlur = async (): Promise<void> => {
    if (!getAvailableAreaOnBlur) {
      return;
    }
    const parsedValue = parseLocalizedNumber(inputValue, locale);
    if (inputValue.trim() !== '' && parsedValue === null) {
      return;
    }
    const nextAvailableArea = await getAvailableAreaOnBlur(parsedValue);
    if (
      parsedValue !== null &&
      nextAvailableArea !== null &&
      parsedValue > nextAvailableArea
    ) {
      setAvailableArea(nextAvailableArea);
      setShowAvailableAreaError(true);
      return;
    }
    setAvailableArea(null);
    setShowAvailableAreaError(false);
  };

  const handleApplyAvailableArea = async (): Promise<void> => {
    if (availableArea === null) {
      return;
    }
    setInputValue(
      formatLocalizedNumber(availableArea, locale, {
        useGrouping: false,
        maximumFractionDigits: 2,
      })
    );
    setShowAvailableAreaError(false);
    await applyValue(availableArea);
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
        type="text"
        inputMode="decimal"
        inputRef={inputRef}
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        size="small"
        error={areaExceeded || showAvailableAreaError}
        helperText={
          showAvailableAreaError && availableArea !== null ? (
            <Stack spacing={0.5}>
              <Typography component="span" variant="caption">
                {areaExceededMessage}
              </Typography>
              <Typography component="span" variant="caption">
                {availableAreaLabel}: {formatArea(availableArea)}
              </Typography>
              <Button
                size="small"
                variant="text"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  void handleApplyAvailableArea();
                }}
                sx={{ alignSelf: 'flex-start', p: 0, minWidth: 0 }}
              >
                {applyAvailableAreaLabel}
              </Button>
            </Stack>
          ) : undefined
        }
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
