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

function isMaxAreaKeyword(value: string, maxKeyword: string): boolean {
  const normalized = value.trim().toLowerCase();
  return [maxKeyword.trim().toLowerCase(), 'maximum'].includes(normalized);
}

function parseAreaInput(value: string, locale: string, maxKeyword: string): number | string | null {
  const normalized = value.trim();
  if (normalized === '') {
    return null;
  }
  if (isMaxAreaKeyword(normalized, maxKeyword)) {
    return normalized;
  }
  return parseLocalizedNumber(value, locale) ?? value;
}

function getInitialInputValue(
  value: unknown,
  fallbackValue: number | null | undefined,
  locale: string,
): string {
  if (typeof value === 'string' && value.trim() !== '' && Number.isNaN(Number(value))) {
    return value;
  }
  const normalizedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : null;
  if (typeof normalizedValue === 'number' && !Number.isNaN(normalizedValue)) {
    return formatLocalizedNumber(normalizedValue, locale, {
      useGrouping: false,
      maximumFractionDigits: 2,
    });
  }
  if (typeof fallbackValue === 'number' && !Number.isNaN(fallbackValue)) {
    return formatLocalizedNumber(fallbackValue, locale, {
      useGrouping: false,
      maximumFractionDigits: 2,
    });
  }
  return '';
}


export interface AreaM2EditCellProps extends GridRenderEditCellParams {
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
    onLastEditedFieldChange,
    fallbackValue,
    locale,
    maxKeyword,
    maxPlaceholder,
  } = props;
  const apiRef = useGridApiContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState<string>(
    () => getInitialInputValue(value, fallbackValue, locale)
  );


  useEffect(() => {
    if (hasFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [hasFocus]);

  const applyValue = async (nextValue: number | string | null): Promise<void> => {
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
      fullWidth
      placeholder={maxPlaceholder}
      slotProps={{
        htmlInput: {
          min: 0,
          step: 0.01,
        },
      }}
      sx={{
        minWidth: 96,
        flex: 1,
        '& .MuiInputBase-root': {
          height: '100%',
          outline: 'none',
          boxShadow: 'none',
        },
        '& .MuiOutlinedInput-notchedOutline': {
          border: 0,
        },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
          border: 0,
        },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
          border: 0,
        },
      }}
    />
  );
}
