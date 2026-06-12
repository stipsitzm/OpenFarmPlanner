/**
 * Generic edit cell for date fields in editable data grids.
 */

import { memo, useEffect, useRef } from 'react';
import { TextField } from '@mui/material';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';

const toIsoDateString = (value: unknown): string | null => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return null;
};

function DateEditCellComponent(params: GridRenderEditCellParams) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputValue = toIsoDateString(params.value) ?? '';

  useEffect(() => {
    if (!params.hasFocus) {
      return;
    }

    inputRef.current?.focus();
  }, [params.hasFocus]);

  return (
    <TextField
      type="date"
      fullWidth
      size="small"
      inputRef={inputRef}
      value={inputValue}
      slotProps={{
        htmlInput: {
          tabIndex: params.hasFocus ? 0 : -1,
        },
      }}
      onChange={async (event) => {
        const nextValue = event.target.value
          ? new Date(`${event.target.value}T00:00:00`)
          : null;
        await params.api.setEditCellValue({
          id: params.id,
          field: params.field,
          value: nextValue,
        });
      }}
    />
  );
}

export const DateEditCell = memo(DateEditCellComponent, (previous, next) => (
  previous.id === next.id
  && previous.field === next.field
  && previous.value === next.value
  && previous.hasFocus === next.hasFocus
));
