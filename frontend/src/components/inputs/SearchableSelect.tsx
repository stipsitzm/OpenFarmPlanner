/**
 * Searchable select input based on MUI Autocomplete.
 *
 * @remarks
 * Use for form-level searchable dropdowns with a shared option shape.
 *
 * @param props - Component props.
 * @param props.options - Options to display.
 * @param props.value - Currently selected option.
 * @param props.onChange - Callback when selection changes.
 * @param props.label - TextField label.
 * @param props.placeholder - TextField placeholder.
 * @param props.noOptionsText - Text to show when no options match.
 * @param props.size - Input size.
 * @param props.fullWidth - Whether to stretch to container width.
 * @param props.autoFocus - Whether to focus the input on mount.
 * @param props.textFieldSx - Optional sx overrides for the TextField.
 * @returns Searchable select input.
 */

import { useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';

export interface SearchableSelectOption<T = unknown> {
  value: number;
  label: string;
  data?: T;
}

export interface SearchableSelectProps<T = unknown> {
  options: SearchableSelectOption<T>[];
  value: SearchableSelectOption<T> | null;
  onChange: (value: SearchableSelectOption<T> | null) => void;
  label?: string;
  placeholder?: string;
  noOptionsText?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  autoFocus?: boolean;
  inputTabIndex?: number;
  textFieldSx?: SxProps<Theme>;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  endAdornment?: ReactNode;
}

export function SearchableSelect<T = unknown>({
  options,
  value,
  onChange,
  label,
  placeholder,
  noOptionsText,
  size = 'medium',
  fullWidth = true,
  autoFocus = false,
  inputTabIndex,
  textFieldSx,
  inputValue,
  onInputChange,
  endAdornment,
}: SearchableSelectProps<T>) {
  const [internalInputValue, setInternalInputValue] = useState('');
  const resolvedInputValue = inputValue ?? internalInputValue;

  const handleInputChange = (_: unknown, newInputValue: string, reason: string) => {
    if (inputValue === undefined) {
      setInternalInputValue(newInputValue);
    }
    if (reason === 'input' || reason === 'clear') {
      onInputChange?.(newInputValue);
    }
  };

  return (
    <Autocomplete
      fullWidth={fullWidth}
      autoHighlight
      openOnFocus
      size={size}
      options={options}
      value={value}
      inputValue={resolvedInputValue}
      onInputChange={handleInputChange}
      onChange={(_, newValue) => onChange(newValue)}
      isOptionEqualToValue={(option, selected) => option.value === selected.value}
      getOptionLabel={(option) => option.label}
      renderOption={(props, option) => (
        <li {...props} key={option.value}>
          {option.label}
        </li>
      )}
      noOptionsText={noOptionsText}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          autoFocus={autoFocus}
          sx={textFieldSx}
          slotProps={{
            htmlInput: {
              ...params.inputProps,
              tabIndex: inputTabIndex,
            },
          }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                {params.InputProps.endAdornment}
                {endAdornment}
              </span>
            ),
          }}
        />
      )}
    />
  );
}
