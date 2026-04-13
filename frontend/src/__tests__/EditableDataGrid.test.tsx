import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GridColDef } from '@mui/x-data-grid';
import { AxiosError } from 'axios';
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
    onCellKeyDown,
    onRowEditStop,
    slots,
  }: unknown) => {
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
                    {col.getActions({ id: row.id, row } as unknown)}
                  </div>
                );
              }
              if (typeof col.renderCell === 'function') {
                return (
                  <div key={`${row.id}-${col.field}`}>
                    {col.renderCell({ id: row.id, row, value: row[col.field as keyof TestGridRow] } as never)}
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
            <button
              type="button"
              onClick={() =>
                onCellKeyDown?.({ id: row.id, field: 'name' }, { key: 'Escape', preventDefault: vi.fn() })
              }
            >
              ESC {row.id}
            </button>
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
        {rows.length === 0 && slots?.noRowsOverlay ? <slots.noRowsOverlay /> : null}
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

  it('renders custom empty state when there are no rows', async () => {
    const props = baseProps();
    const onAction = vi.fn();
    props.api = {
      ...props.api,
      list: vi.fn(async () => ({ data: { results: [] } })),
    };

    render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        emptyState={{
          title: 'Noch keine Anbaupläne vorhanden',
          description: 'Lege deinen ersten Anbauplan an, um mit der Planung zu beginnen.',
          actionLabel: 'Anbauplan erstellen',
          onAction,
        }}
      />,
    );

    expect(await screen.findByText('Noch keine Anbaupläne vorhanden')).toBeInTheDocument();
    expect(
      screen.getByText('Lege deinen ersten Anbauplan an, um mit der Planung zu beginnen.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anbauplan erstellen' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('supports add, blur/enter/tab commit flows and calls API save with payload', async () => {
    const validateRow = vi
      .fn<(row: TestGridRow) => string | null>()
      .mockImplementation((row) => (!row.name ? 'Name ist erforderlich' : null));
    const props = baseProps(validateRow);
    const createSpy = vi.spyOn(props.api, 'create');
    const updateSpy = vi.spyOn(props.api, 'update');

    render(<EditableDataGrid {...props} />);

    await waitFor(() => expect(screen.getByText('Zelle 1-name')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Neu'));
    fireEvent.click(screen.getByRole('button', { name: /Blur speichern -1/i }));
    expect(screen.getByText('messages.validationErrors')).toBeInTheDocument();

    validateRow.mockReturnValue(null);
    fireEvent.click(screen.getByRole('button', { name: /Enter speichern -1/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('button', { name: /Tab speichern 1/i })[0]);
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

  it('shows backend validation message instead of generic axios status text', async () => {
    const props = baseProps(() => null);
    const axiosError = new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST');
    axiosError.response = {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
      data: {
        area_usage_sqm: ['Die Fläche dieses Beets wird im überlappenden Zeitraum überschritten.'],
      },
    };
    vi.spyOn(props.api, 'update').mockRejectedValue(axiosError);

    render(<EditableDataGrid {...props} showDeleteAction={false} />);

    await waitFor(() => expect(screen.getByText('Zelle 1-name')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Tab speichern 1/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Fläche (m²): Die Fläche dieses Beets wird im überlappenden Zeitraum überschritten.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('blocks navigation when cell enters edit mode', async () => {
    const user = userEvent.setup();

    render(<EditableDataGrid {...baseProps()} showDeleteAction={false} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Zelle 1-name' }));

    await waitFor(() => {
      expect(mockUseNavigationBlocker).toHaveBeenLastCalledWith(false, 'messages.unsavedChanges');
    });
  });

  it('keeps draft rows local and exposes save controls until saved', async () => {
    const props = baseProps((row) => (!row.name ? 'Name ist erforderlich' : null));
    const createSpy = vi.spyOn(props.api, 'create');
    render(<EditableDataGrid {...props} showDeleteAction={false} />);

    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
    fireEvent.click(screen.getByLabelText('Neu'));
    expect(screen.getByRole('button', { name: 'actions.save' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Blur speichern -1/i }));
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('discards draft rows with Escape', async () => {
    render(<EditableDataGrid {...baseProps()} showDeleteAction={false} />);
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
    fireEvent.click(screen.getByLabelText('Neu'));
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: 'ESC -1' }));
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
  });

  it('shows row-bound save/cancel actions only while row is being edited', async () => {
    const user = userEvent.setup();
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showFooterEditControls={false}
        showRowEditActions={true}
      />,
    );

    await waitFor(() => expect(screen.queryByRole('button', { name: 'actions.save' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Zelle 1-name' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'actions.save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'actions.cancel' })).toBeInTheDocument();
    });
  });

  it('clears row dirty indicator after cancel', async () => {
    const user = userEvent.setup();
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showFooterEditControls={false}
        showRowEditActions={true}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Zelle 1-name' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'actions.cancel' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'ESC 1' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'actions.cancel' })).not.toBeInTheDocument());
  });

  it('clears row dirty indicator after successful save', async () => {
    const user = userEvent.setup();
    const props = baseProps(() => null);
    const updateSpy = vi.spyOn(props.api, 'update');
    render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        showFooterEditControls={false}
        showRowEditActions={true}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Zelle 1-name' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'actions.save' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Tab speichern 1/i }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
  });
});
