import { useState, useEffect, useRef } from 'react';
import { TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';

export const parseGermanDateText = (text: string): Date | null => {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
};

export const formatDateAsGerman = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
};

export function GermanDateEditCell({ id, field, value, hasFocus }: GridRenderEditCellParams) {
  const apiRef = useGridApiContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState<string>(formatDateAsGerman(value as Date | null));

  useEffect(() => {
    if (!hasFocus) {
      setText(formatDateAsGerman(value as Date | null));
    }
  }, [hasFocus, value]);

  useEffect(() => {
    if (hasFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [hasFocus]);

  return (
    <TextField
      type="text"
      inputRef={inputRef}
      value={text}
      placeholder="TT.MM.JJJJ"
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = parseGermanDateText(raw);
        void apiRef.current.setEditCellValue({ id, field, value: parsed ?? (raw === '' ? null : value) });
      }}
      slotProps={{ input: { sx: { fontSize: 'inherit' } } }}
      variant="standard"
      sx={{ width: '100%', px: 1 }}
    />
  );
}
