import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GridColDef } from '@mui/x-data-grid';
import { EditableDataGrid } from '../components/data-grid/DataGrid';
import { createGridApiMock, createGridRow, type TestGridRow } from './helpers/factories';
import { mockT } from './helpers/testI18n';

const mockUseNavigationBlocker = vi.fn();

vi.mock('../hooks/autosave', () => ({
  useNavigationBlocker: (...args: unknown[]) => mockUseNavigationBlocker(...args),
}));

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('@mui/x-data-grid', async () => {
  const React = await import('react');
  const GridRowModes = { Edit: 'edit', View: 'view' };
  const GridRowEditStopReasons = {
    rowFocusOut: 'rowFocusOut',
    enterKeyDown: 'enterKeyDown',
    tabKeyDown: 'tabKeyDown',
    escapeKeyDown: 'escapeKeyDown',
  };

  const DataGrid = ({
    rows,
    columns,
    processRowUpdate,
    onProcessRowUpdateError,
    onCellClick,
    onRowEditStop,
    slots,
  }: any) => {
    const commit = async (row: TestGridRow, reason: string) => {
      try {
        await processRowUpdate(row);
      } catch (error) {
        onProcessRowUpdateError?.(error);
      }
      onRowEditStop?.({ reason }, { defaultMuiPrevented: false });
    };

    return (
      <div>
        <div data-testid="row-count">{rows.length}</div>
        {rows.map((row: TestGridRow) => (
          <div key={row.id}>
            {columns.map((col: GridColDef) => {
              if (typeof col.getActions === 'function') {
                return (
                  <div key={`${row.id}-${col.field}`}>
                    {col.getActions({ id: row.id, row } as any)}
                  </div>
                );
              }

              return (
                <button
                  key={`${row.id}-${col.field}`}
                  type="button"
                  onClick={() => onCellClick?.({ id: row.id, field: col.field, isEditable: col.editable !== false })}
                >
                  Zelle {row.id}-{col.field}
                </button>
              );
            })}
            <button type="button" onClick={() => commit(row, GridRowEditStopReasons.rowFocusOut)}>
              Blur speichern {row.id}
            </button>
            <button type="button" onClick={() => commit(row, GridRowEditStopReasons.enterKeyDown)}>
              Enter speichern {row.id}
            </button>
            <button type="button" onClick={() => commit(row, GridRowEditStopReasons.tabKeyDown)}>
              Tab speichern {row.id}
            </button>
          </div>
        ))}
        {slots?.footer ? <slots.footer /> : null}
      </div>
    );
  };

  return { DataGrid, GridRowModes, GridRowEditStopReasons };
});

describe('EditableDataGrid', () => {
  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', editable: true },
    { field: 'area_sqm', headerName: 'Fläche', editable: true },
  ];

  const baseProps = (validateRow = (row: TestGridRow) => (!row.name ? 'Name ist erforderlich' : null)) => ({
    columns,
    api: createGridApiMock(),
    createNewRow: () => createGridRow({ id: -1, isNew: true, name: '' }),
    mapToRow: (item: TestGridRow) => item,
    mapToApiData: (row: TestGridRow) => ({ name: row.name, area_sqm: row.area_sqm, notes: row.notes }),
    validateRow,
    loadErrorMessage: 'Laden fehlgeschlagen',
    saveErrorMessage: 'Speichern fehlgeschlagen',
    deleteErrorMessage: 'Löschen fehlgeschlagen',
    deleteConfirmMessage: 'Wirklich löschen?',
    addButtonLabel: 'Neu',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with minimal props and loads rows', async () => {
    render(<EditableDataGrid {...baseProps()} showDeleteAction={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('1');
    });
  });

  it('supports add, blur/enter/tab commit flows and calls API save with payload', async () => {
    const user = userEvent.setup();
    const validateRow = vi
      .fn<(row: TestGridRow) => string | null>()
      .mockImplementation((row) => (!row.name ? 'Name ist erforderlich' : null));
    const props = baseProps(validateRow);
    const createSpy = vi.spyOn(props.api, 'create');
    const updateSpy = vi.spyOn(props.api, 'update');

    render(<EditableDataGrid {...props} />);

    await waitFor(() => expect(screen.getByText('Zelle 1-name')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Neu'));
    await user.click(screen.getByRole('button', { name: /Blur speichern -1/i }));
    expect(screen.getByText('Name ist erforderlich')).toBeInTheDocument();

    validateRow.mockReturnValue(null);
    await user.click(screen.getByRole('button', { name: /Enter speichern -1/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalled());

    await user.click(screen.getAllByRole('button', { name: /Tab speichern 1/i })[0]);
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    expect(updateSpy).toHaveBeenLastCalledWith(100, expect.objectContaining({ area_sqm: 12 }));
  });

  it('prevents delete when canceled and deletes when confirmed', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const deleteSpy = vi.spyOn(props.api, 'delete');

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    render(<EditableDataGrid {...props} />);

    await waitFor(() => expect(screen.getByLabelText('Löschen')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Löschen'));
    expect(deleteSpy).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText('Löschen'));
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(1));
  });

  it('blocks navigation when cell enters edit mode', async () => {
    const user = userEvent.setup();

    render(<EditableDataGrid {...baseProps()} showDeleteAction={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Zelle 1-name' }));

    await waitFor(() => {
      expect(mockUseNavigationBlocker).toHaveBeenLastCalledWith(true, 'messages.unsavedChanges');
    });
  });
});
