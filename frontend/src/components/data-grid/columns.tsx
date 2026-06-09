/**
 * Data Grid column builders shared across pages.
 */

import { memo } from 'react';
import type { GridColDef, GridRenderEditCellParams } from '@mui/x-data-grid';
import { Box, MenuItem, TextField, Tooltip } from '@mui/material';
import { SearchableSelectEditCell } from './SearchableSelectEditCell';
import type { SearchableSelectOption } from './SearchableSelectEditCell';

interface StandardSingleSelectEditCellProps extends GridRenderEditCellParams {
  options: SearchableSelectOption[];
}

const StandardSingleSelectEditCell = memo(function StandardSingleSelectEditCell({
  id,
  field,
  value,
  hasFocus,
  api,
  options,
}: StandardSingleSelectEditCellProps) {
  return (
    <TextField
      select
      fullWidth
      size="small"
      autoFocus={hasFocus}
      value={value ?? ''}
      slotProps={{
        htmlInput: {
          tabIndex: hasFocus ? 0 : -1,
        },
      }}
      onChange={async (event) => {
        await api.setEditCellValue({
          id,
          field,
          value: event.target.value,
        });
      }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}, (previous, next) => (
  previous.id === next.id
  && previous.field === next.field
  && previous.value === next.value
  && previous.hasFocus === next.hasFocus
  && previous.options === next.options
));

export interface SearchableSelectColumnConfig<Row extends { [key: string]: unknown }> {
  field: keyof Row;
  headerName: string;
  flex: number;
  minWidth: number;
  options: SearchableSelectOption[];
  maxWidth?: number;
  truncateCellText?: boolean;
}

/**
 * Build a searchable single-select column for the Data Grid.
 *
 * @remarks
 * Ensures select values are stored as numeric IDs.
 *
 * @param config - Column configuration.
 * @returns Data Grid column definition.
 */
export const createSearchableSelectColumn = <Row extends { [key: string]: unknown }>(
  config: SearchableSelectColumnConfig<Row>
): GridColDef => {
  const { field, headerName, flex, minWidth, options, maxWidth, truncateCellText = false } = config;

  return {
    field: String(field),
    headerName,
    flex,
    minWidth,
    maxWidth,
    editable: true,
    type: 'singleSelect',
    valueOptions: options,
    valueFormatter: (value) => {
      if (value === null || value === undefined) {
        return '';
      }
      const numericValue = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numericValue)) {
        return '';
      }
      const option = options.find((item) => item.value === numericValue);
      return option ? option.label : '';
    },
    renderCell: (params) => {
      if (!truncateCellText) {
        return params.formattedValue as string;
      }

      const text = String(params.formattedValue ?? '');
      return (
        <Tooltip title={text} disableHoverListener={!text}>
          <Box
            component="span"
            sx={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            {text}
          </Box>
        </Tooltip>
      );
    },
    renderEditCell: (params) => (
      <SearchableSelectEditCell
        {...params}
        options={options}
      />
    ),
    valueSetter: (value, row) => {
      const numericValue = typeof value === 'number' ? value : Number(value);
      return { ...row, [field]: numericValue } as Row;
    },
    preProcessEditCellProps: (params) => {
      const hasError = !params.props.value || params.props.value === 0;
      return { ...params.props, error: hasError };
    },
  };
};

/**
 * Build a standard single-select column for the Data Grid.
 *
 * @remarks
 * Ensures select values are stored as numeric IDs.
 *
 * @param config - Column configuration.
 * @returns Data Grid column definition.
 */
export const createSingleSelectColumn = <Row extends { [key: string]: unknown }>(
  config: SearchableSelectColumnConfig<Row>
): GridColDef => {
  const { field, headerName, flex, minWidth, options, maxWidth, truncateCellText = false } = config;

  return {
    field: String(field),
    headerName,
    flex,
    minWidth,
    maxWidth,
    editable: true,
    type: 'singleSelect',
    valueOptions: options,
    valueFormatter: (value) => {
      if (value === null || value === undefined) {
        return '';
      }
      const numericValue = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(numericValue)) {
        return '';
      }
      const option = options.find((item) => item.value === numericValue);
      return option ? option.label : '';
    },
    renderCell: (params) => {
      if (!truncateCellText) {
        return params.formattedValue as string;
      }

      const text = String(params.formattedValue ?? '');
      return (
        <Tooltip title={text} disableHoverListener={!text}>
          <Box
            component="span"
            sx={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            {text}
          </Box>
        </Tooltip>
      );
    },
    renderEditCell: (params) => (
      <StandardSingleSelectEditCell
        {...params}
        options={options}
      />
    ),
    valueSetter: (value, row) => {
      const numericValue = typeof value === 'number' ? value : Number(value);
      return { ...row, [field]: numericValue } as Row;
    },
    preProcessEditCellProps: (params) => {
      const hasError = !params.props.value || params.props.value === 0;
      return { ...params.props, error: hasError };
    },
  };
};
