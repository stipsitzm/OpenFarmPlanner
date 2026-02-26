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
  '& .MuiDataGrid-cell': {
    bgcolor: '#f5f5f5',
    transition: 'background-color 0.15s',
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
  '& .MuiDataGrid-cell:focus-within': {
    overflow: 'visible',
  },
  '& .MuiDataGrid-columnHeader': {
    px: 0.5,
  },
  '& .MuiDataGrid-columnHeaderTitleContainer': {
    gap: 0.25,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  '& .MuiDataGrid-iconButtonContainer, & .MuiDataGrid-menuIcon': {
    order: -1,
    marginLeft: 0,
    marginRight: 2,
  },
  '& .MuiDataGrid-columnHeaderTitleContainerContent': {
    minWidth: 0,
    overflow: 'hidden',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& .MuiDataGrid-menuIcon .MuiIconButton-root, & .MuiDataGrid-iconButtonContainer .MuiIconButton-root': {
    padding: 2,
  },
};

/**
 * Common styles for footer containers in DataGrid
 */
export const dataGridFooterSx = {
  p: 1,
  display: 'flex',
  justifyContent: 'center',
  borderTop: '1px solid',
  borderColor: 'divider',
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
