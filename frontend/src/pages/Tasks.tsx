/**
 * Tasks (Aufgaben) page component.
 * 
 * Manages farm tasks with Excel-like editable data grid.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Tasks page component
 */

import type { GridColDef } from '@mui/x-data-grid';
import { taskAPI, type Task } from '../api/client';
import { EditableDataGrid, type EditableRow, type DataGridAPI } from '../components/EditableDataGrid';

/**
 * Row data type for Data Grid
 */
interface TaskRow extends Task, EditableRow {
  id: number;
  isNew?: boolean;
}

/**
 * Get display label for status
 */
const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    'pending': 'Ausstehend',
    'in_progress': 'In Bearbeitung',
    'completed': 'Abgeschlossen',
    'cancelled': 'Abgebrochen',
  };
  return statusMap[status] || status;
};

function Tasks(): React.ReactElement {
  /**
   * Define columns for the Data Grid with inline editing
   */
  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Titel',
      width: 250,
      editable: true,
      preProcessEditCellProps: (params) => {
        const hasError = !params.props.value || params.props.value.trim() === '';
        return { ...params.props, error: hasError };
      },
    },
    {
      field: 'description',
      headerName: 'Beschreibung',
      width: 300,
      editable: true,
    },
    {
      field: 'due_date',
      headerName: 'Fälligkeitsdatum',
      width: 150,
      type: 'date',
      editable: true,
      valueGetter: (value) => value ? new Date(value) : null,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      editable: true,
      type: 'singleSelect',
      valueOptions: [
        { value: 'pending', label: 'Ausstehend' },
        { value: 'in_progress', label: 'In Bearbeitung' },
        { value: 'completed', label: 'Abgeschlossen' },
        { value: 'cancelled', label: 'Abgebrochen' },
      ],
      valueFormatter: (value) => getStatusLabel(value as string),
    },
  ];

  return (
    <div className="page-container">
      <h1>Aufgaben</h1>
      
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
            return 'Titel ist ein Pflichtfeld';
          }
          return null;
        }}
        loadErrorMessage="Fehler beim Laden der Aufgaben"
        saveErrorMessage="Fehler beim Speichern der Aufgabe"
        deleteErrorMessage="Fehler beim Löschen der Aufgabe"
        deleteConfirmMessage="Möchten Sie diese Aufgabe wirklich löschen?"
        addButtonLabel="Neue Aufgabe hinzufügen"
      />
    </div>
  );
}

export default Tasks;
