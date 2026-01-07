/**
 * Tasks (Aufgaben) page component.
 * 
 * Manages farm tasks with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Tasks page component
 */

import type { GridColDef } from '@mui/x-data-grid';
import { useTranslation } from '../i18n';
import { taskAPI, type Task } from '../api/api';
import { EditableDataGrid, type EditableRow, type DataGridAPI } from '../components/EditableDataGrid';

/**
 * Row data type for Data Grid
 */
interface TaskRow extends Task, EditableRow {
  id: number;
  isNew?: boolean;
}

function Tasks(): React.ReactElement {
  const { t } = useTranslation('tasks');
  
  /**
   * Get display label for status
   */
  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      'pending': t('status.pending'),
      'in_progress': t('status.inProgress'),
      'completed': t('status.completed'),
      'cancelled': t('status.cancelled'),
    };
    return statusMap[status] || status;
  };
  
  /**
   * Define columns for the Data Grid with inline editing
   */
  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: t('columns.title'),
      width: 250,
      editable: true,
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'description',
      headerName: t('columns.description'),
      width: 300,
      editable: true,
    },
    {
      field: 'due_date',
      headerName: t('columns.dueDate'),
      width: 150,
      type: 'date',
      editable: true,
      valueGetter: (value) => value ? new Date(value) : null,
    },
    {
      field: 'status',
      headerName: t('columns.status'),
      width: 150,
      editable: true,
      type: 'singleSelect',
      valueOptions: [
        { value: 'pending', label: t('status.pending') },
        { value: 'in_progress', label: t('status.inProgress') },
        { value: 'completed', label: t('status.completed') },
        { value: 'cancelled', label: t('status.cancelled') },
      ],
      valueFormatter: (value) => getStatusLabel(value as string),
    },
  ];

  return (
    <div className="page-container">
      <h1>{t('title')}</h1>
      
      <EditableDataGrid<TaskRow>
        columns={columns}
        api={taskAPI as unknown as DataGridAPI<TaskRow>}
        createNewRow={() => ({
          id: -Date.now(),
          title: '',
          description: '',
          due_date: '',
          status: 'pending',
          isNew: true,
        })}
        mapToRow={(task) => ({
          ...task,
          id: task.id!,
          title: task.title || '',
          description: task.description || '',
          due_date: task.due_date || '',
          status: task.status,
        })}
        mapToApiData={(row) => ({
          title: row.title,
          description: row.description || '',
          due_date: row.due_date || '',
          status: row.status,
        })}
        validateRow={(row) => {
          if (!row.title || row.title.trim() === '') {
            return t('validation.titleRequired');
          }
          return null;
        }}
        loadErrorMessage={t('errors.load')}
        saveErrorMessage={t('errors.save')}
        deleteErrorMessage={t('errors.delete')}
        deleteConfirmMessage={t('confirmDelete')}
        addButtonLabel={t('addButton')}
      />
    </div>
  );
}

export default Tasks;
