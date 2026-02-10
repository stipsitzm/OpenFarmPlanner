/**
 * Edit cell for searchable single-select fields in DataGrid.
 *
 * @remarks
 * Uses MUI Autocomplete to provide inline search for large option lists.
 *
 * @param props - Component props.
 * @param props.options - Select options with value and label.
 * @returns Autocomplete-based edit cell.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';

export interface SearchableSelectOption {
  value: number;
  label: string;
}

export interface SearchableSelectEditCellProps extends GridRenderEditCellParams {
  options: SearchableSelectOption[];
}

export function SearchableSelectEditCell({
  id,
  value,
  field,
  options,
}: SearchableSelectEditCellProps): React.ReactElement {
  const apiRef = useGridApiContext();
  const initialValueRef = useRef(value);
  const [inputValue, setInputValue] = useState('');

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const [currentOption, setCurrentOption] = useState<SearchableSelectOption | null>(
    selectedOption
  );

  useEffect(() => {
    setCurrentOption(selectedOption);
  }, [selectedOption]);

  const handleChange = (_: unknown, newValue: SearchableSelectOption | null) => {
    setCurrentOption(newValue);
    const nextValue = newValue?.value ?? null;

    if (nextValue !== initialValueRef.current) {
      apiRef.current.setEditCellValue({
        id,
        field,
        value: nextValue,
      });
    }
  };

  return (
    <Autocomplete
      fullWidth
      autoHighlight
      openOnFocus
      size="small"
      options={options}
      value={currentOption}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
      onChange={handleChange}
      isOptionEqualToValue={(option, selected) => option.value === selected.value}
      getOptionLabel={(option) => option.label}
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus
          sx={{ '& .MuiInputBase-root': { height: '100%' } }}
        />
      )}
    />
  );
}
