/**
 * Data Grid column builders shared across pages.
 */

import type { GridColDef } from '@mui/x-data-grid';
import { Box, Tooltip } from '@mui/material';
import { SearchableSelectEditCell } from './SearchableSelectEditCell';
import type { SearchableSelectOption } from './SearchableSelectEditCell';

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
