/**
 * Central styling for MUI DataGrid components
 * 
 * This file provides common style objects that can be reused across
 * all DataGrid instances in the application for consistent styling.
 */

import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { CALCULATED_COLUMN_CELL_CLASS, CALCULATED_COLUMN_HEADER_CLASS } from './calculatedColumns';

const CALCULATED_COLUMN_BACKGROUND = '#F5F5F5';
const CALCULATED_COLUMN_TEXT = 'rgba(0,0,0,0.85)';
const EDITING_ROW_BACKGROUND_ALPHA = 0.06;
const DIRTY_CELL_BACKGROUND_ALPHA = 0.08;
const FOCUSED_CELL_BACKGROUND_ALPHA = 0.04;
const FOCUSED_CELL_RING_ALPHA = 0.48;

const getPrimaryOverlay = (theme: Theme, opacity: number): string =>
  alpha(theme.palette.primary.main, opacity);

const getDataGridCellFocusRing = (theme: Theme): string =>
  `inset 0 0 0 2px ${alpha(theme.palette.primary.main, FOCUSED_CELL_RING_ALPHA)}`;

const getErrorCellRing = (theme: Theme): string =>
  `inset 0 0 0 2px ${theme.palette.error.main}`;

const getErrorCellFocusRing = (theme: Theme): string =>
  `${getErrorCellRing(theme)}, inset 0 0 0 4px ${alpha(theme.palette.primary.main, 0.28)}`;

/**
 * Common styles for MUI DataGrid components
 */
export const dataGridSx = {
  border: '1px solid',
  borderColor: 'surface.surfaceSoftBorder',
  borderRadius: 3,
  backgroundColor: 'surface.surfaceBackground',
  boxShadow: '0 1px 2px rgba(21, 31, 24, 0.03)',
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: 'surface.surfaceSubtleBackground',
    borderBottom: '1px solid',
    borderBottomColor: 'surface.surfaceSoftBorder',
  },
  '& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within': {
    outline: 'none',
    boxShadow: (theme: Theme) => getDataGridCellFocusRing(theme),
  },
  '& .MuiDataGrid-row': {
    minHeight: 44,
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: 'surface.surfaceHoverBackground',
  },
  '& .MuiDataGrid-row:hover .MuiDataGrid-cell': {
    backgroundColor: 'surface.surfaceHoverBackground',
  },
  '& .MuiDataGrid-cell': {
    borderColor: 'surface.surfaceSoftBorder',
    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
  },
  '& .MuiDataGrid-cell--editable': {
    bgcolor: (theme: Theme) =>
      theme.palette.mode === 'dark'
        ? '#383838'
        : (theme.palette.surface?.surfaceBackground ?? theme.palette.background.paper),
    cursor: 'pointer',
  },
  '& .MuiDataGrid-cell--editable:hover': {
    backgroundColor: 'surface.surfaceHoverBackground',
  },
  '& .MuiDataGrid-cell--editing': {
    overflow: 'visible',
    backgroundColor: (theme: Theme) => getPrimaryOverlay(theme, EDITING_ROW_BACKGROUND_ALPHA),
  },
  '& .MuiDataGrid-cell--editing .MuiInputBase-root': {
    minHeight: '100%',
    height: 'auto',
    alignItems: 'center',
  },
  '& .MuiDataGrid-cell--editing .MuiInputBase-input': {
    lineHeight: 1.4,
    paddingTop: '8px',
    paddingBottom: '8px',
  },
  '& .MuiDataGrid-cell--editing .MuiSelect-select': {
    minHeight: 'unset !important',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1.4,
    paddingTop: '8px',
    paddingBottom: '8px',
  },
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
    outline: 'none',
    overflow: 'visible',
    backgroundColor: (theme: Theme) => getPrimaryOverlay(theme, FOCUSED_CELL_BACKGROUND_ALPHA),
    boxShadow: (theme: Theme) => getDataGridCellFocusRing(theme),
  },
  [
    '& .MuiDataGrid-cell.ofp-cell-error:focus',
    '& .MuiDataGrid-cell.ofp-cell-error:focus-within',
  ].join(', '): {
    boxShadow: (theme: Theme) => getErrorCellFocusRing(theme),
  },
  '& .MuiDataGrid-columnHeaderTitleContainer': {
    minWidth: 0,
  },
  '& .ofp-cell-error': {
    boxShadow: (theme: Theme) => getErrorCellRing(theme),
  },
  '& .MuiDataGrid-row:hover .ofp-cell-error': {
    boxShadow: (theme: Theme) => getErrorCellRing(theme),
  },
  '& .ofp-cell-dirty': {
    backgroundColor: (theme: Theme) => getPrimaryOverlay(theme, DIRTY_CELL_BACKGROUND_ALPHA),
  },
  '& .MuiDataGrid-row:hover .ofp-cell-dirty': {
    backgroundColor: (theme: Theme) => getPrimaryOverlay(theme, DIRTY_CELL_BACKGROUND_ALPHA),
  },
  '& .ofp-row-editing, & .MuiDataGrid-row--editing': {
    backgroundColor: (theme: Theme) => getPrimaryOverlay(theme, EDITING_ROW_BACKGROUND_ALPHA),
  },
  [
    '& .ofp-row-editing .MuiDataGrid-cell',
    '& .ofp-row-editing:hover .MuiDataGrid-cell',
    '& .MuiDataGrid-row--editing .MuiDataGrid-cell',
    '& .MuiDataGrid-row--editing:hover .MuiDataGrid-cell',
  ].join(', '): {
    backgroundColor: (theme: Theme) => getPrimaryOverlay(theme, EDITING_ROW_BACKGROUND_ALPHA),
  },
  [`& .${CALCULATED_COLUMN_HEADER_CLASS}`]: {
    backgroundColor: CALCULATED_COLUMN_BACKGROUND,
    color: CALCULATED_COLUMN_TEXT,
  },
  [`& .${CALCULATED_COLUMN_HEADER_CLASS}:hover`]: {
    backgroundColor: CALCULATED_COLUMN_BACKGROUND,
  },
  [`& .${CALCULATED_COLUMN_CELL_CLASS}`]: {
    backgroundColor: CALCULATED_COLUMN_BACKGROUND,
    color: CALCULATED_COLUMN_TEXT,
  },
  [`& .MuiDataGrid-row:hover .${CALCULATED_COLUMN_CELL_CLASS}`]: {
    backgroundColor: 'surface.surfaceHoverBackground',
  },
  [
    '& .ofp-row-editing:hover .MuiDataGrid-cell',
    '& .MuiDataGrid-row--editing:hover .MuiDataGrid-cell',
  ].join(', '): {
    backgroundColor: (theme: Theme) => getPrimaryOverlay(theme, EDITING_ROW_BACKGROUND_ALPHA),
  },
  [
    '& .MuiDataGrid-row.Mui-selected .MuiDataGrid-cell',
    '& .MuiDataGrid-row.Mui-selected:hover .MuiDataGrid-cell',
  ].join(', '): {
    backgroundColor: 'action.selected',
  },
  [
    '& .MuiDataGrid-row.Mui-selected .MuiDataGrid-cell:focus',
    '& .MuiDataGrid-row.Mui-selected .MuiDataGrid-cell:focus-within',
  ].join(', '): {
    backgroundColor: 'action.selected',
    boxShadow: (theme: Theme) => getDataGridCellFocusRing(theme),
  },
};

/**
 * Common styles for footer containers in DataGrid
 */
export const dataGridFooterSx = {
  p: 1,
  display: 'flex',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: 1,
  borderTop: '1px solid',
  borderColor: 'divider',
  position: 'sticky',
  bottom: 0,
  backgroundColor: 'surface.surfaceBackground',
  zIndex: 2,
};

/**
 * Common styles for delete action IconButtons
 */
export const deleteIconButtonSx = {
  color: '#d32f2f',
  '&:hover': {
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
  },
};
