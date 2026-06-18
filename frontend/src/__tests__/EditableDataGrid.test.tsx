import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GridColDef } from '@mui/x-data-grid';
import { AxiosError } from 'axios';
import { EditableDataGrid, type EditableDataGridCommandApi } from '../components/data-grid/DataGrid';
import { createGridApiMock, createGridRow, type TestGridRow } from './helpers/factories';
import { mockT } from './helpers/testI18n';

const mockUseNavigationBlocker = vi.fn();
const mockStopRowEditMode = vi.hoisted(() => vi.fn());
const mockFilteredSortedRowIds = vi.hoisted(() => vi.fn());

vi.mock('../hooks/autosave', () => ({
  useNavigationBlocker: (...args: unknown[]) => mockUseNavigationBlocker(...args),
}));

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('@mui/x-data-grid', async () => {
  const React = await import('react');
  const createGridApiMockRefValue = () => ({
    setEditCellValue: vi.fn().mockResolvedValue(true),
    stopRowEditMode: mockStopRowEditMode,
  });
  const useGridApiRef = vi.fn(() => React.useRef(createGridApiMockRefValue()));
  const GridRowModes = { Edit: 'edit', View: 'view' };
  const GridRowEditStopReasons = {
    rowFocusOut: 'rowFocusOut',
    enterKeyDown: 'enterKeyDown',
    tabKeyDown: 'tabKeyDown',
    escapeKeyDown: 'escapeKeyDown',
  };
  const getMockFilterOperators = () => [
    {
      value: 'contains',
      getApplyFilterFn: () => () => true,
    },
  ];

  const DataGrid = ({
    apiRef,
    rows,
    columns,
    processRowUpdate,
    onProcessRowUpdateError,
    onCellClick,
    onCellKeyDown,
    onRowEditStop,
    rowModesModel,
    slots,
  }: unknown) => {
    const [, forceFocusRender] = React.useState(0);

    if (apiRef?.current) {
      apiRef.current.state = apiRef.current.state ?? { focus: { cell: null } };
      apiRef.current.filteredSortedRowIds = rows.map((row: TestGridRow) => row.id);
      apiRef.current.getVisibleColumns = () => columns;
      apiRef.current.getRowWithUpdatedValues = (id: string | number) =>
        rows.find((row: TestGridRow) => String(row.id) === String(id)) ?? null;
      apiRef.current.getRowIndexRelativeToVisibleRows = (id: string | number) =>
        rows.findIndex((row: TestGridRow) => String(row.id) === String(id));
      apiRef.current.getColumnIndexRelativeToVisibleColumns = (field: string) =>
        columns.findIndex((column: GridColDef) => column.field === field);
      apiRef.current.getCellParams = (id: string | number, field: string) => {
        const row = rows.find((currentRow: TestGridRow) => String(currentRow.id) === String(id));
        return { id, field, row };
      };
      apiRef.current.isCellEditable = (params: { field: string }) =>
        columns.find((column: GridColDef) => column.field === params.field)?.editable !== false;
      apiRef.current.scrollToIndexes = vi.fn();
      apiRef.current.setCellFocus = (id: string | number, field: string) => {
        apiRef.current.state.focus.cell = { id, field };
        forceFocusRender((version) => version + 1);
      };
    }

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
          <div key={row.id} role="row" data-id={String(row.id)} data-testid={`row-${row.id}`}>
            <span data-testid={`mode-${row.id}`}>{rowModesModel?.[row.id]?.mode ?? GridRowModes.View}</span>
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
                <div key={`${row.id}-${col.field}`}>
                  {col.renderEditCell && (
                    <span
                      data-testid={`edit-renderer-${row.id}-${col.field}`}
                      data-width={col.width ?? ''}
                      data-min-width={col.minWidth ?? ''}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (apiRef?.current) {
                        apiRef.current.state.focus.cell = { id: row.id, field: col.field };
                      }
                      onCellClick?.({ id: row.id, field: col.field, isEditable: col.editable !== false });
                    }}
                  >
                    Zelle {row.id}-{col.field}
                  </button>
                </div>
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
            <button
              type="button"
              onClick={() =>
                onCellKeyDown?.(
                  { id: row.id, field: 'name' },
                  {
                    key: 'Enter',
                    shiftKey: false,
                    ctrlKey: false,
                    metaKey: false,
                    altKey: false,
                    target: document.createElement('input'),
                    preventDefault: vi.fn(),
                    defaultMuiPrevented: false,
                  },
                )
              }
            >
              Eingabe per Return {row.id}
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
        <span data-testid="focused-cell">
          {apiRef?.current?.state?.focus?.cell
            ? `${apiRef.current.state.focus.cell.id}-${apiRef.current.state.focus.cell.field}`
            : 'none'}
        </span>
        {slots?.footer ? <slots.footer /> : null}
      </div>
    );
  };

  return {
    DataGrid,
    GridRowModes,
    GridRowEditStopReasons,
    getGridBooleanOperators: getMockFilterOperators,
    getGridDateOperators: getMockFilterOperators,
    getGridNumericOperators: getMockFilterOperators,
    getGridSingleSelectOperators: getMockFilterOperators,
    getGridStringOperators: getMockFilterOperators,
    gridFilteredSortedRowIdsSelector: (apiRef: { current?: { filteredSortedRowIds?: Array<string | number> } }) =>
      mockFilteredSortedRowIds(apiRef.current?.filteredSortedRowIds ?? [])
      ?? apiRef.current?.filteredSortedRowIds
      ?? [],
    useGridApiRef,
  };
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with minimal props and loads rows', async () => {
    render(<EditableDataGrid {...baseProps()} showDeleteAction={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('1');
    });
  });

  it('renders table-wide actions above the grid inside the table surface', async () => {
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showTableActions
        columnVisibilityModel={{}}
        onColumnVisibilityModelChange={vi.fn()}
      />,
    );

    const button = await screen.findByRole('button', { name: 'tableActions.tooltip' });
    const surface = screen.getByTestId('data-grid-surface');
    const toolbar = screen.getByTestId('data-grid-table-actions-toolbar');

    expect(button).toHaveTextContent('tableActions.button');
    expect(button).toHaveClass('MuiButton-outlinedSecondary');
    expect(surface).toContainElement(toolbar);
    expect(toolbar.nextElementSibling).toContainElement(screen.getByTestId('row-count'));
  });

  it('hides table-wide actions in the mobile layout', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width:900px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showTableActions
        columnVisibilityModel={{}}
        onColumnVisibilityModelChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('1');
    });
    expect(screen.queryByTestId('data-grid-table-actions-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tableActions.tooltip' })).not.toBeInTheDocument();
  });

  it('separates row actions from table actions', async () => {
    const user = userEvent.setup();
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
        showTableActions
        columnVisibilityModel={{}}
        onColumnVisibilityModelChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    fireEvent.contextMenu(screen.getByTestId('row-1'));

    expect(screen.getByRole('menuitem', { name: 'actions.copyRow' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'actions.copyTable' })).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await user.click(screen.getByRole('button', { name: 'tableActions.tooltip' }));

    expect(screen.getByRole('menuitem', { name: 'columnVisibility.button' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'actions.copyTable' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'actions.export' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'actions.copyRow' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'columnVisibility.button' }));
    expect(screen.getByRole('menuitem', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Fläche/ })).toBeInTheDocument();
  });

  it('opens the shared export dialog with all supported table formats', async () => {
    const user = userEvent.setup();
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showTableActions
        columnVisibilityModel={{}}
        onColumnVisibilityModelChange={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'tableActions.tooltip' }));
    await user.click(screen.getByRole('menuitem', { name: 'actions.export' }));

    expect(screen.getByRole('dialog', { name: 'tableActions.exportDialogTitle' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'tableActions.formatXlsx' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'tableActions.formatOds' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'tableActions.formatCsv' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /tableActions.formatJson/ })).toBeInTheDocument();
  });

  it('copies only visible columns from the filtered and sorted grid rows', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const props = baseProps();
    vi.spyOn(props.api, 'list').mockResolvedValue({
      data: {
        results: [
          createGridRow({ id: 1, name: 'Beet A', area_sqm: 12 }),
          createGridRow({ id: 2, name: 'Beet B', area_sqm: 24 }),
        ],
      },
    });

    render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        showTableActions
        columnVisibilityModel={{ area_sqm: false }}
        onColumnVisibilityModelChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-2')).toBeInTheDocument());
    mockFilteredSortedRowIds.mockReturnValueOnce([2]);
    await user.click(screen.getByRole('button', { name: 'tableActions.tooltip' }));
    await user.click(screen.getByRole('menuitem', { name: 'actions.copyTable' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Name\nBeet B'));
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
    expect(updateSpy).toHaveBeenLastCalledWith(expect.any(Number), expect.objectContaining({ area_sqm: 12 }));
  });

  it('commits command draft values and stops row edit mode', async () => {
    const props = baseProps();
    const updateSpy = vi.spyOn(props.api, 'update');
    const commandApiRef: { current: EditableDataGridCommandApi | null } = { current: null };

    render(<EditableDataGrid {...props} commandApiRef={commandApiRef} showDeleteAction={false} />);

    await waitFor(() => expect(commandApiRef.current).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Zelle 1-name' }));
    await waitFor(() => expect(screen.getByTestId('mode-1')).toHaveTextContent('edit'));

    await commandApiRef.current?.commitDraftValues(1, { area_sqm: 5 });

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({ area_sqm: 5 })));
    expect(mockStopRowEditMode).toHaveBeenCalledWith({ id: 1, ignoreModifications: true });
    await waitFor(() => expect(screen.getByTestId('mode-1')).toHaveTextContent('view'));
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

  it('runs before-save validation for implicit blur persistence and keeps blocked rows editable', async () => {
    const props = baseProps(() => null);
    const updateSpy = vi.spyOn(props.api, 'update');
    const onBeforeSaveRow = vi.fn(() => false);

    render(
      <EditableDataGrid
        {...props}
        onBeforeSaveRow={onBeforeSaveRow}
        showDeleteAction={false}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Zelle 1-name' }));
    await waitFor(() => expect(screen.getByTestId('mode-1')).toHaveTextContent('edit'));
    fireEvent.click(screen.getByRole('button', { name: 'Blur speichern 1' }));

    await waitFor(() => expect(onBeforeSaveRow).toHaveBeenCalled());
    expect(updateSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('mode-1')).toHaveTextContent('edit');
  });

  it('saves transformed before-save values directly on input Enter', async () => {
    const props = baseProps(() => null);
    const updateSpy = vi.spyOn(props.api, 'update');
    const onBeforeSaveRow = vi.fn((row: TestGridRow) => ({
      ...row,
      area_sqm: 4,
    }));

    render(
      <EditableDataGrid
        {...props}
        onBeforeSaveRow={onBeforeSaveRow}
        showDeleteAction={false}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Zelle 1-name' }));
    await waitFor(() => expect(screen.getByTestId('mode-1')).toHaveTextContent('edit'));
    fireEvent.click(screen.getByRole('button', { name: 'Eingabe per Return 1' }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({ area_sqm: 4 }));
    });
    expect(onBeforeSaveRow).toHaveBeenCalledTimes(1);
  });

  it('adds the shared edit renderer to date columns without changing column width', async () => {
    render(
      <EditableDataGrid
        {...baseProps(() => null)}
        columns={[
          { field: 'name', headerName: 'Name', editable: true },
          { field: 'planting_date', headerName: 'Pflanzdatum', type: 'date', editable: true, minWidth: 96, width: 96 },
        ]}
        showDeleteAction={false}
      />,
    );

    expect(await screen.findByTestId('edit-renderer-1-planting_date')).toBeInTheDocument();
    expect(screen.getByTestId('edit-renderer-1-planting_date')).toHaveAttribute('data-width', '96');
    expect(screen.getByTestId('edit-renderer-1-planting_date')).toHaveAttribute('data-min-width', '96');
    expect(screen.getByRole('button', { name: 'Zelle 1-planting_date' })).toBeInTheDocument();
  });

  it('discards draft rows with Escape', async () => {
    render(<EditableDataGrid {...baseProps()} showDeleteAction={false} />);
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
    fireEvent.click(screen.getByLabelText('Neu'));
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: 'ESC -1' }));
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
  });

  it('removes touched draft rows with Escape without saving or validating', async () => {
    const props = baseProps((row) => (!row.name ? 'Name ist erforderlich' : null));
    const createSpy = vi.spyOn(props.api, 'create');

    render(<EditableDataGrid {...props} showDeleteAction={false} />);

    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
    fireEvent.click(screen.getByLabelText('Neu'));
    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Zelle -1-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'ESC -1' }));

    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
    expect(createSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('messages.validationErrors')).not.toBeInTheDocument();
    expect(screen.queryByText('Name ist erforderlich')).not.toBeInTheDocument();
  });

  it('cancels existing row edits with Escape without saving or validating', async () => {
    const props = baseProps((row) => (!row.name ? 'Name ist erforderlich' : null));
    const updateSpy = vi.spyOn(props.api, 'update');

    render(<EditableDataGrid {...props} showDeleteAction={false} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Zelle 1-name' }));
    await waitFor(() => expect(screen.getByTestId('mode-1')).toHaveTextContent('edit'));
    fireEvent.click(screen.getByRole('button', { name: 'ESC 1' }));

    await waitFor(() => expect(screen.getByTestId('mode-1')).toHaveTextContent('view'));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('messages.validationErrors')).not.toBeInTheDocument();
    expect(screen.queryByText('Name ist erforderlich')).not.toBeInTheDocument();
  });

  it('moves through a new planting plan row with Tab without row validation', async () => {
    const props = baseProps((row) => {
      const missing = [
        !row.planting_date ? 'Pflanzdatum' : null,
        !row.bed ? 'Beet' : null,
      ].filter(Boolean);
      return missing.length > 0
        ? `Folgende Pflichtfelder müssen ausgefüllt werden: ${missing.join(', ')}`
        : null;
    });
    const createSpy = vi.spyOn(props.api, 'create');
    const plantingPlanColumns: GridColDef[] = [
      { field: 'culture', headerName: 'Kultur', editable: true },
      { field: 'planting_date', headerName: 'Pflanzdatum', editable: true },
      { field: 'bed', headerName: 'Beet', editable: true },
    ];

    render(
      <EditableDataGrid
        {...props}
        columns={plantingPlanColumns}
        createNewRow={() => ({
          id: -1,
          isNew: true,
          culture: 1,
          planting_date: '',
          bed: '',
        } as TestGridRow)}
        showDeleteAction={false}
      />,
    );

    await screen.findByRole('button', { name: 'Zelle 1-culture' });
    fireEvent.click(await screen.findByLabelText('Neu'));
    const cultureCell = await screen.findByRole('button', { name: 'Zelle -1-culture' });
    fireEvent.click(cultureCell);

    fireEvent.keyDown(cultureCell, { key: 'Tab' });

    await waitFor(() => expect(screen.getByTestId('focused-cell')).toHaveTextContent('-1-planting_date'));
    expect(screen.queryByText(/Folgende Pflichtfelder müssen ausgefüllt werden/)).not.toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();

    fireEvent.keyDown(await screen.findByRole('button', { name: 'Zelle -1-planting_date' }), {
      key: 'Tab',
      shiftKey: true,
    });

    await waitFor(() => expect(screen.getByTestId('focused-cell')).toHaveTextContent('-1-culture'));
    expect(screen.queryByText(/Folgende Pflichtfelder müssen ausgefüllt werden/)).not.toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('shows required-field validation when explicitly saving an incomplete new row', async () => {
    const props = baseProps((row) => {
      const missing = [
        !row.planting_date ? 'Pflanzdatum' : null,
        !row.bed ? 'Beet' : null,
      ].filter(Boolean);
      return missing.length > 0
        ? `Folgende Pflichtfelder müssen ausgefüllt werden: ${missing.join(', ')}`
        : null;
    });
    const createSpy = vi.spyOn(props.api, 'create');
    const plantingPlanColumns: GridColDef[] = [
      { field: 'culture', headerName: 'Kultur', editable: true },
      { field: 'planting_date', headerName: 'Pflanzdatum', editable: true },
      { field: 'bed', headerName: 'Beet', editable: true },
    ];

    render(
      <EditableDataGrid
        {...props}
        columns={plantingPlanColumns}
        createNewRow={() => ({
          id: -1,
          isNew: true,
          culture: 1,
          planting_date: '',
          bed: '',
        } as TestGridRow)}
        showDeleteAction={false}
      />,
    );

    await screen.findByRole('button', { name: 'Zelle 1-culture' });
    fireEvent.click(await screen.findByLabelText('Neu'));
    const saveDraftButton = await screen.findByRole('button', { name: 'Blur speichern -1' });
    fireEvent.click(saveDraftButton);

    expect(await screen.findByText('Folgende Pflichtfelder müssen ausgefüllt werden: Pflanzdatum, Beet')).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
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

  it('opens contextual row actions without rendering a permanent action column', async () => {
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();

    const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(contextMenuEvent, 'stopPropagation');
    fireEvent(screen.getByTestId('row-1'), contextMenuEvent);

    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplizieren' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Löschen' })).toBeInTheDocument();
    expect(contextMenuEvent.defaultPrevented).toBe(true);
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it('keeps row actions right-click only without a hover trigger', async () => {
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    fireEvent.mouseMove(screen.getByTestId('row-1'));

    expect(screen.queryByRole('button', { name: 'Aktionen' })).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByTestId('row-1'));

    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplizieren' })).toBeInTheDocument();
  });

  it('duplicates a row from the contextual menu and starts editing the copy', async () => {
    const user = userEvent.setup();
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('1'));
    fireEvent.contextMenu(screen.getByTestId('row-1'));
    await user.click(screen.getByRole('menuitem', { name: 'Duplizieren' }));

    await waitFor(() => expect(screen.getByTestId('row-count')).toHaveTextContent('2'));
    expect(screen.getByTestId('mode--2')).toHaveTextContent('edit');
  });

  it('runs delete from the contextual row action menu', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const deleteSpy = vi.spyOn(props.api, 'delete');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    fireEvent.contextMenu(screen.getByTestId('row-1'));
    await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(1));
  });

  it('optimistically removes a row and restores it from the delete undo snackbar', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    vi.spyOn(props.api, 'list').mockResolvedValue({
      data: { results: [createGridRow({ id: 1 }), createGridRow({ id: 2, name: 'Beet B' })] },
    });
    const deleteSpy = vi.spyOn(props.api, 'delete');
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
        deleteUndoOptions={{ message: 'Anbauplan gelöscht' }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    fireEvent.contextMenu(screen.getByTestId('row-1'));
    await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));

    expect(screen.queryByTestId('row-1')).not.toBeInTheDocument();
    expect(screen.getByText('Anbauplan gelöscht')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rückgängig: Anbauplan gelöscht' })).toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Rückgängig: Anbauplan gelöscht' }));

    expect(screen.getByTestId('row-1')).toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('finalizes optimistic delete after the 8000 ms undo window', async () => {
    const props = baseProps();
    const deleteSpy = vi.spyOn(props.api, 'delete');

    render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
        deleteUndoOptions={{ message: 'Anbauplan gelöscht' }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    fireEvent.contextMenu(screen.getByTestId('row-1'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Löschen' }));

    vi.advanceTimersByTime(7999);
    expect(deleteSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(deleteSpy).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('discards an unsaved new row without backend delete or undo state', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    const deleteSpy = vi.spyOn(props.api, 'delete');
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(
      <EditableDataGrid
        {...props}
        deleteUndoOptions={{ message: 'Anbauplan gelöscht' }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Neu'));
    await waitFor(() => expect(screen.getByTestId('row--1')).toBeInTheDocument());
    await user.click(within(screen.getByTestId('row--1')).getByLabelText('Löschen'));

    expect(screen.queryByTestId('row--1')).not.toBeInTheDocument();
    expect(screen.queryByText('Anbauplan gelöscht')).not.toBeInTheDocument();
    expect(screen.getByTestId('focused-cell')).not.toHaveTextContent('-1-');
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('handles multiple optimistic deletions independently', async () => {
    const props = baseProps();
    vi.spyOn(props.api, 'list').mockResolvedValue({
      data: { results: [createGridRow({ id: 1 }), createGridRow({ id: 2, name: 'Beet B' })] },
    });
    const deleteSpy = vi.spyOn(props.api, 'delete');

    render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -3, isNew: true })}
        deleteUndoOptions={{ message: 'Anbauplan gelöscht' }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    fireEvent.contextMenu(screen.getByTestId('row-1'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Löschen' }));
    fireEvent.contextMenu(screen.getByTestId('row-2'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Löschen' }));

    expect(screen.queryByTestId('row-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Rückgängig: Anbauplan gelöscht' })[0]);
    expect(screen.getByTestId('row-1')).toBeInTheDocument();
    expect(screen.queryByTestId('row-2')).not.toBeInTheDocument();

    vi.advanceTimersByTime(8000);
    await Promise.resolve();
    expect(deleteSpy).toHaveBeenCalledWith(2);
    expect(deleteSpy).not.toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('restores an optimistically deleted row to its previous sorted position', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    vi.spyOn(props.api, 'list').mockResolvedValue({
      data: { results: [createGridRow({ id: 1 }), createGridRow({ id: 2, name: 'Beet B' })] },
    });

    render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
        deleteUndoOptions={{ message: 'Anbauplan gelöscht' }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    fireEvent.contextMenu(screen.getByTestId('row-1'));
    await user.click(screen.getByRole('menuitem', { name: 'Löschen' }));
    await user.click(screen.getByRole('button', { name: 'Rückgängig: Anbauplan gelöscht' }));

    expect(screen.getAllByRole('row').map((row) => row.getAttribute('data-id'))).toEqual(['1', '2']);
  });

  it('cleans pending optimistic delete timers on unmount', async () => {
    const props = baseProps();
    const deleteSpy = vi.spyOn(props.api, 'delete');
    const { unmount } = render(
      <EditableDataGrid
        {...props}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
        deleteUndoOptions={{ message: 'Anbauplan gelöscht' }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('row-1')).toBeInTheDocument());
    fireEvent.contextMenu(screen.getByTestId('row-1'));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Löschen' }));
    unmount();
    vi.advanceTimersByTime(8000);

    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('keeps inline editing available when contextual actions are enabled', async () => {
    const user = userEvent.setup();
    render(
      <EditableDataGrid
        {...baseProps()}
        showDeleteAction={false}
        showRowEditActions={false}
        duplicateRow={(row) => ({ ...row, id: -2, isNew: true })}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Zelle 1-name' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Zelle 1-name' }));

    await waitFor(() => expect(screen.getByTestId('mode-1')).toHaveTextContent('edit'));
  });
});
