// frontend/src/components/dataGridStyles.ts
// Zentrales Styling für MUI DataGrid

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
