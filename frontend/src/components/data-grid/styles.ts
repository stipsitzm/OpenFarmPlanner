/**
 * Central styling for MUI DataGrid components
 * 
 * This file provides common style objects that can be reused across
 * all DataGrid instances in the application for consistent styling.
 */

import type { Theme } from '@mui/material/styles';

/**
 * Common styles for MUI DataGrid components
 */
export const dataGridSx = {
  border: '1px solid #e5e7eb',
  borderRadius: 3,
  backgroundColor: '#fbfcfa',
  boxShadow: '0 1px 2px rgba(21, 31, 24, 0.03)',
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#f5f7f4',
    borderBottom: '1px solid #e3e8e3',
  },
  '& .MuiDataGrid-row': {
    minHeight: 44,
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: '#f1f5ef',
  },
  '& .MuiDataGrid-cell': {
    borderColor: '#edf1ee',
    transition: 'background-color 0.15s ease',
  },
  '& .MuiDataGrid-cell--editable': {
    bgcolor: (theme: Theme) =>
      theme.palette.mode === 'dark' ? '#383838' : '#fff',
    cursor: 'pointer',
  },
  '& .MuiDataGrid-cell--editable:hover': {
    backgroundColor: '#e3f2fd',
  },
  '& .MuiDataGrid-cell--editing': {
    overflow: 'visible',
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
  '& .MuiDataGrid-cell:focus-within': {
    overflow: 'visible',
  },
  '& .MuiDataGrid-columnHeaderTitleContainer': {
    minWidth: 0,
  },
  '& .ofp-cell-error': {
    boxShadow: 'inset 0 0 0 2px #d32f2f',
  },
  '& .ofp-cell-dirty': {
    backgroundColor: 'rgba(25, 118, 210, 0.08)',
  },
  '& .ofp-row-editing': {
    boxShadow: 'inset 3px 0 0 #1976d2',
    backgroundColor: 'rgba(25, 118, 210, 0.05)',
  },
  '& .ofp-row-dirty': {
    boxShadow: 'inset 3px 0 0 #ed6c02',
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
  backgroundColor: '#fff',
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
