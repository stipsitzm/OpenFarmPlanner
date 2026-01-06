// frontend/src/components/dataGridStyles.ts
// Zentrales Styling für MUI DataGrid

/**
 * Common styles for MUI DataGrid components
 */
export const dataGridSx = {
  '& .MuiDataGrid-cell': {
    bgcolor: '#f5f5f5',
    transition: 'background-color 0.15s',
  },
  '& .MuiDataGrid-cell--editable': {
    bgcolor: (theme: any) =>
      theme.palette.mode === 'dark' ? '#383838' : '#fff',
    cursor: 'pointer',
  },
  '& .MuiDataGrid-cell--editable:hover': {
    backgroundColor: '#e3f2fd',
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

