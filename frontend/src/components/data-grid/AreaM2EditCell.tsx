/**
 * Edit cell for area_m2 field in PlantingPlans grid.
 *
 * Provides a numeric input for area editing with optional normalization on blur.
 */

import { useEffect, useRef, useState } from 'react';
import { TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { formatLocalizedNumber, parseLocalizedNumber } from '../../utils/numberLocalization';

function parseAreaInput(value: string, locale: string, maxKeyword: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === '') {
    return null;
  }
  if (normalized === maxKeyword.trim().toLowerCase()) {
    return null;
  }
  return parseLocalizedNumber(value, locale);
}


export interface AreaM2EditCellProps extends GridRenderEditCellParams {
  bedAreaSqm?: number;
  onLastEditedFieldChange: (field: 'area_m2') => void;
  fallbackValue?: number | null;
  locale: string;
  maxKeyword: string;
  maxPlaceholder: string;
}

export function AreaM2EditCell(props: AreaM2EditCellProps): React.ReactElement {
  const {
    id,
    value,
    field,
    hasFocus,
    bedAreaSqm,
    onLastEditedFieldChange,
    fallbackValue,
    locale,
    maxKeyword,
    maxPlaceholder,
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
    const parsedValue = parseAreaInput(val, locale, maxKeyword);
    await applyValue(parsedValue);
  };

  return (
    <TextField
      type="text"
      inputMode="decimal"
      inputRef={inputRef}
      value={inputValue}
      onChange={handleChange}
      size="small"
      placeholder={maxPlaceholder}
      slotProps={{
        htmlInput: {
          min: 0,
          step: 0.01,
        },
      }}
      sx={{ minWidth: 96, flex: 1 }}
    />
  );
}
