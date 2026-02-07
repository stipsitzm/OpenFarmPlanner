/**
 * Data Grid module exports
 * 
 * Central export point for all DataGrid-related utilities
 */

export { EditableDataGrid } from './EditableDataGrid';
export type { 
  EditableRow, 
  DataGridAPI, 
  EditableDataGridProps,
  NotesFieldConfig,
} from './EditableDataGrid';
export { NotesCell } from './NotesCell';
export { NotesDrawer } from './NotesDrawer';
export { getPlainExcerpt, stripMarkdown } from './markdown';
export { useNotesEditor } from './useNotesEditor';
export type { UseNotesEditorConfig, UseNotesEditorReturn, NotesEditorSaveOptions } from './useNotesEditor';

export { handleEditableCellClick, handleRowEditStop } from './handlers';

export { dataGridSx, dataGridFooterSx, deleteIconButtonSx } from './styles';
