import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GridColDef } from '@mui/x-data-grid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import FieldsBedsHierarchy, {
  isCompletelyEmptyNewHierarchyRow,
  isPartiallyFilledNamelessNewHierarchyRow,
} from '../pages/FieldsBedsHierarchy';
import { hasPersistedEntityId } from '../components/hierarchy/utils/hierarchyUtils';
import { mockT } from './helpers/testI18n';

const {
  bedCreateMock,
  bedDeleteMock,
  bedListMock,
  bedUpdateMock,
  fieldCreateMock,
  fieldDeleteMock,
  fieldListMock,
  fieldUpdateMock,
  locationCreateMock,
  locationDeleteMock,
  locationListMock,
  locationUpdateMock,
  mockUseNavigationBlocker,
  mockDrafts,
  setCellFocusMock,
} = vi.hoisted(() => ({
  bedCreateMock: vi.fn(),
  bedDeleteMock: vi.fn(),
  bedListMock: vi.fn(),
  bedUpdateMock: vi.fn(),
  fieldCreateMock: vi.fn(),
  fieldDeleteMock: vi.fn(),
  fieldListMock: vi.fn(),
  fieldUpdateMock: vi.fn(),
  locationCreateMock: vi.fn(),
  locationDeleteMock: vi.fn(),
  locationListMock: vi.fn(),
  locationUpdateMock: vi.fn(),
  mockUseNavigationBlocker: vi.fn(),
  mockDrafts: new Map<string, Record<string, unknown>>(),
  setCellFocusMock: vi.fn((id: string | number, field: string) => {
    document.querySelector<HTMLElement>(`[data-testid="cell-${String(id)}-${field}"]`)?.focus();
  }),
}));

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('../commands/useCommandContext', () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
}));

vi.mock('../hooks/autosave', () => ({
  useNavigationBlocker: (...args: unknown[]) => mockUseNavigationBlocker(...args),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    bedAPI: {
      create: bedCreateMock,
      delete: bedDeleteMock,
      list: bedListMock,
      update: bedUpdateMock,
    },
    fieldAPI: {
      create: fieldCreateMock,
      delete: fieldDeleteMock,
      list: fieldListMock,
      update: fieldUpdateMock,
    },
    locationAPI: {
      create: locationCreateMock,
      delete: locationDeleteMock,
      list: locationListMock,
      update: locationUpdateMock,
    },
  };
});

vi.mock('@mui/x-data-grid', async () => {
  const GridRowModes = { Edit: 'edit', View: 'view' };
  const GridRowEditStopReasons = {
    enterKeyDown: 'enterKeyDown',
    escapeKeyDown: 'escapeKeyDown',
    rowFocusOut: 'rowFocusOut',
  };

  const useGridApiRef = vi.fn(() => ({
    current: {
      getRowWithUpdatedValues: (id: string | number) => mockDrafts.get(String(id)) ?? null,
      setCellFocus: setCellFocusMock,
    },
  }));

  const DataGrid = ({
    apiRef,
    columns,
    isCellEditable,
    onCellClick,
    onCellKeyDown,
    onProcessRowUpdateError,
    onRowEditStop,
    onRowModesModelChange,
    processRowUpdate,
    rowModesModel,
    rows,
  }: {
    apiRef?: { current?: { getRowWithUpdatedValues?: (id: string | number, field: string) => unknown } };
    columns: GridColDef[];
    isCellEditable?: (params: { row: Record<string, unknown>; field: string }) => boolean;
    onCellClick?: (params: { id: string | number; field: string; isEditable: boolean; row: Record<string, unknown> }) => void;
    onCellKeyDown?: (params: { id: string | number; field: string; isEditable: boolean; row: Record<string, unknown> }, event: React.KeyboardEvent) => void;
    onProcessRowUpdateError?: (error: Error) => void;
    onRowEditStop?: (
      params: { id: string | number; reason: string },
      event: { defaultMuiPrevented: boolean; stopPropagation?: () => void },
    ) => void;
    onRowModesModelChange?: (model: Record<string, { mode: string }>) => void;
    processRowUpdate?: (row: Record<string, unknown>) => Promise<Record<string, unknown>>;
    rowModesModel: Record<string, { mode: string; fieldToFocus?: string }>;
    rows: Array<Record<string, unknown> & { id: string | number }>;
  }) => {
    if (apiRef?.current) {
      apiRef.current.getRowWithUpdatedValues = (id: string | number) => mockDrafts.get(String(id)) ?? null;
    }

    const commitBlur = async (
      row: Record<string, unknown> & { id: string | number },
      reason = GridRowEditStopReasons.rowFocusOut,
    ): Promise<void> => {
      const draft = mockDrafts.get(String(row.id)) ?? row;
      try {
        await processRowUpdate?.(draft);
      } catch (error) {
        onProcessRowUpdateError?.(error as Error);
      }
      onRowEditStop?.(
        { id: row.id, reason },
        { defaultMuiPrevented: false, stopPropagation: vi.fn() },
      );
      if (reason === GridRowEditStopReasons.enterKeyDown) {
        onRowModesModelChange?.({
          ...rowModesModel,
          [row.id]: { mode: GridRowModes.View },
        });
      }
    };

    return (
      <div data-testid="hierarchy-grid">
        <div data-testid="row-count">{rows.length}</div>
        {rows.map((row) => {
          const mode = rowModesModel[row.id]?.mode ?? rowModesModel[String(row.id)]?.mode ?? GridRowModes.View;
          const handleCellKeyDown = (
            field: string,
            editable: boolean,
            event: React.KeyboardEvent<HTMLElement>,
          ): void => {
            onCellKeyDown?.(
              { id: row.id, field, isEditable: editable, row },
              event as React.KeyboardEvent,
            );
            if (
              event.key === 'Enter' &&
              mode === GridRowModes.Edit &&
              !(event as React.KeyboardEvent & { defaultMuiPrevented?: boolean }).defaultMuiPrevented &&
              !event.isPropagationStopped()
            ) {
              void commitBlur(row, GridRowEditStopReasons.enterKeyDown);
            }
          };

          return (
            <div data-id={String(row.id)} data-testid={`row-${row.id}`} key={String(row.id)} role="row">
              <span data-testid={`mode-${row.id}`}>{mode}</span>
              <span data-testid={`focus-field-${row.id}`}>{rowModesModel[row.id]?.fieldToFocus ?? ''}</span>
              {columns.map((column) => {
                const editable = Boolean(column.editable) && (isCellEditable?.({ row, field: column.field }) ?? true);
                if (typeof column.renderCell === 'function') {
                  return (
                    <div
                      data-testid={`cell-${row.id}-${column.field}`}
                      key={`${row.id}-${column.field}`}
                      onKeyDown={(event) => handleCellKeyDown(column.field, editable, event)}
                      tabIndex={0}
                    >
                      {column.renderCell({
                        api: {},
                        cellMode: mode === GridRowModes.Edit ? 'edit' : 'view',
                        field: column.field,
                        id: row.id,
                        row,
                        value: row[column.field],
                      } as never)}
                    </div>
                  );
                }
                return (
                  <button
                    data-testid={`cell-${row.id}-${column.field}`}
                    key={`${row.id}-${column.field}`}
                    type="button"
                    onClick={() => onCellClick?.({ id: row.id, field: column.field, isEditable: editable, row })}
                    onKeyDown={(event) => handleCellKeyDown(column.field, editable, event)}
                  >
                    {`Cell ${row.id}-${column.field}`}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const nameColumn = columns.find((column) => column.field === 'name');
                  const nameEditable = Boolean(nameColumn?.editable) && (isCellEditable?.({ row, field: 'name' }) ?? true);
                  onCellClick?.({ id: row.id, field: 'name', isEditable: nameEditable, row });
                }}
              >
                {`Edit ${row.id}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  mockDrafts.set(String(row.id), { ...row, name: 'Teilweise gefuellt' });
                }}
              >
                {`Partial name ${row.id}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  mockDrafts.set(String(row.id), { ...row, name: '', length_m: 2 });
                }}
              >
                {`Partial invalid ${row.id}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  mockDrafts.set(String(row.id), { ...row, length_m: 12 });
                }}
              >
                {`Length value ${row.id}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  mockDrafts.set(String(row.id), { ...row, width_m: 4 });
                }}
              >
                {`Width value ${row.id}`}
              </button>
              <button
                type="button"
                onClick={() =>
                  onCellKeyDown?.(
                    { id: row.id, field: 'name', isEditable: true, row },
                    {
                      key: 'Escape',
                      preventDefault: vi.fn(),
                      stopPropagation: vi.fn(),
                      defaultMuiPrevented: false,
                    } as unknown as React.KeyboardEvent,
                  )
                }
              >
                {`Escape ${row.id}`}
              </button>
              <button type="button" onClick={() => void commitBlur(row)}>
                {`Blur ${row.id}`}
              </button>
              <button
                type="button"
                onClick={() => void commitBlur(row, GridRowEditStopReasons.enterKeyDown)}
              >
                {`Enter ${row.id}`}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return {
    DataGrid,
    GridRowEditStopReasons,
    GridRowModes,
    useGridApiRef,
  };
});

const renderHierarchy = (initialPath = '/app/fields-beds') => (
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <FieldsBedsHierarchy showTitle={false} />
      <CurrentRoute />
    </MemoryRouter>,
  )
);

const CurrentRoute = (): React.ReactElement => {
  const currentLocation = useLocation();
  return <div data-testid="current-route">{`${currentLocation.pathname}${currentLocation.search}`}</div>;
};

const renderHierarchyWithCreateFieldRequest = (
  createFieldRequest: number,
  onCreateFieldRequestHandled = vi.fn(),
) => render(
  <MemoryRouter initialEntries={['/app/fields-beds']}>
    <FieldsBedsHierarchy
      showTitle={false}
      createFieldRequest={createFieldRequest}
      onCreateFieldRequestHandled={onCreateFieldRequestHandled}
    />
  </MemoryRouter>,
);

const addNewBed = async (): Promise<void> => {
  fireEvent.click(await screen.findByRole('button', { name: 'Beet zu dieser Parzelle hinzufügen' }));
  await waitFor(() => expect(screen.getByTestId('row--1700000000000')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByTestId('mode--1700000000000')).toHaveTextContent('edit'));
};

const deleteRowViaContextMenu = (row: HTMLElement): void => {
  fireEvent.contextMenu(row);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Löschen' }));
};

const useMultipleLocations = (): void => {
  locationListMock.mockResolvedValue({
    data: {
      results: [
        { id: 1, name: 'Hofstelle' },
        { id: 2, name: 'Außenfläche' },
      ],
    },
  });
};

describe('FieldsBedsHierarchy edit cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDrafts.clear();
    window.sessionStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hofstelle' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 10, name: 'Nordfeld', location: 1, area_sqm: 20 }] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });
    bedDeleteMock.mockResolvedValue({ data: {} });
    bedCreateMock.mockImplementation((data: { name: string; field: number }) => Promise.resolve({
      data: { id: 100 + Number(bedCreateMock.mock.calls.length), ...data },
    }));
    fieldDeleteMock.mockResolvedValue({ data: {} });
    fieldCreateMock.mockImplementation((data: { name: string; location: number }) => Promise.resolve({
      data: { id: 200 + Number(fieldCreateMock.mock.calls.length), ...data },
    }));
    locationDeleteMock.mockResolvedValue({ data: {} });
    locationCreateMock.mockImplementation((data: { name: string }) => Promise.resolve({
      data: { id: 300 + Number(locationCreateMock.mock.calls.length), ...data },
    }));
    fieldUpdateMock.mockResolvedValue({ data: { id: 10, name: 'Nordfeld', location: 1, area_sqm: 20 } });
    bedUpdateMock.mockResolvedValue({ data: { id: 21, name: 'Beet A', field: 10, area_sqm: 10 } });
    locationUpdateMock.mockResolvedValue({ data: { id: 1, name: 'Hofstelle umbenannt' } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects completely empty new hierarchy rows', () => {
    expect(isCompletelyEmptyNewHierarchyRow({ id: -1, type: 'bed', level: 1, isNew: true, name: '', field: 10 })).toBe(true);
    expect(isCompletelyEmptyNewHierarchyRow({ id: -1, type: 'bed', level: 1, isNew: true, name: '', field: 10, length_m: 2 })).toBe(false);
    expect(isPartiallyFilledNamelessNewHierarchyRow({ id: -1, type: 'bed', level: 1, isNew: true, name: '', field: 10, length_m: 2 })).toBe(true);
  });

  it('recognizes only positive integer hierarchy IDs as persisted', () => {
    expect(hasPersistedEntityId(1)).toBe(true);
    expect(hasPersistedEntityId(-1)).toBe(false);
    expect(hasPersistedEntityId(0)).toBe(false);
    expect(hasPersistedEntityId(undefined)).toBe(false);
  });

  it('creates exactly one editable parcel row for one create request', async () => {
    fieldListMock.mockResolvedValue({ data: { results: [] } });
    const onCreateFieldRequestHandled = vi.fn();
    const { rerender } = renderHierarchyWithCreateFieldRequest(1, onCreateFieldRequestHandled);

    await waitFor(() => expect(screen.getByTestId('row-field--1700000000000')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('mode-field--1700000000000')).toHaveTextContent('edit'));
    expect(screen.getByTestId('row-count')).toHaveTextContent('1');
    expect(onCreateFieldRequestHandled).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter initialEntries={['/app/fields-beds']}>
        <FieldsBedsHierarchy
          showTitle={false}
          createFieldRequest={1}
          onCreateFieldRequestHandled={onCreateFieldRequestHandled}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('row-count')).toHaveTextContent('1');
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('enters inline edit mode when a Standort name is clicked', async () => {
    const user = userEvent.setup();
    useMultipleLocations();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));

    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('edit');
  });

  it('cancels inline Standort editing with Escape without saving', async () => {
    const user = userEvent.setup();
    useMultipleLocations();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));
    await user.click(screen.getByRole('button', { name: 'Escape location-1' }));

    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('view');
    expect(locationUpdateMock).not.toHaveBeenCalled();
  });

  it('saves inline Standort name edits through the shared row update flow', async () => {
    const user = userEvent.setup();
    useMultipleLocations();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));
    await user.click(screen.getByRole('button', { name: 'Partial name location-1' }));
    fireEvent.keyDown(screen.getByTestId('cell-location-1-name'), { key: 'Enter' });

    await waitFor(() => {
      expect(locationUpdateMock).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Teilweise gefuellt' }));
    });
    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('view');
  });

  it('saves a location and restores focus to its name cell after Enter', async () => {
    const user = userEvent.setup();
    useMultipleLocations();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));
    await user.click(screen.getByRole('button', { name: 'Partial name location-1' }));
    const locationNameCell = screen.getByTestId('cell-location-1-name');
    fireEvent.keyDown(locationNameCell, { key: 'Enter' });

    await waitFor(() => expect(locationUpdateMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('view');
    await waitFor(() => expect(setCellFocusMock).toHaveBeenCalledWith('location-1', 'name'));
    expect(locationNameCell).toHaveFocus();
    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();
  });

  it('saves a parcel and restores focus to its name cell after Enter', async () => {
    const user = userEvent.setup();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit field-10' }));
    await user.click(screen.getByRole('button', { name: 'Partial name field-10' }));
    const fieldNameCell = screen.getByTestId('cell-field-10-name');
    fireEvent.keyDown(fieldNameCell, { key: 'Enter' });

    await waitFor(() => expect(fieldUpdateMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('mode-field-10')).toHaveTextContent('view');
    await waitFor(() => expect(setCellFocusMock).toHaveBeenCalledWith('field-10', 'name'));
    expect(fieldNameCell).toHaveFocus();
    expect(screen.queryByTestId('row-21')).not.toBeInTheDocument();
  });

  it('saves a bed and restores focus to its name cell after Enter', async () => {
    const user = userEvent.setup();
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit 21' }));
    await user.click(screen.getByRole('button', { name: 'Partial name 21' }));
    const bedNameCell = screen.getByTestId('cell-21-name');
    fireEvent.keyDown(bedNameCell, { key: 'Enter' });

    await waitFor(() => expect(bedUpdateMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('mode-21')).toHaveTextContent('view');
    await waitFor(() => expect(setCellFocusMock).toHaveBeenCalledWith(21, 'name'));
    expect(bedNameCell).toHaveFocus();
  });

  it('starts and saves length editing without redirecting focus to the name cell', async () => {
    const user = userEvent.setup();
    renderHierarchy();

    const lengthCell = await screen.findByTestId('cell-field-10-length_m');
    fireEvent.keyDown(lengthCell, { key: 'Enter' });

    expect(screen.getByTestId('mode-field-10')).toHaveTextContent('edit');
    expect(screen.getByTestId('focus-field-field-10')).toHaveTextContent('length_m');

    await user.click(screen.getByRole('button', { name: 'Length value field-10' }));
    fireEvent.keyDown(lengthCell, { key: 'Enter' });

    await waitFor(() => expect(fieldUpdateMock).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ length_m: 12 }),
    ));
    expect(screen.getByTestId('mode-field-10')).toHaveTextContent('view');
    await waitFor(() => expect(setCellFocusMock).toHaveBeenCalledWith('field-10', 'length_m'));
    expect(lengthCell).toHaveFocus();
    expect(setCellFocusMock).not.toHaveBeenCalledWith('field-10', 'name');
  });

  it('starts and saves width editing without redirecting focus to the name cell', async () => {
    const user = userEvent.setup();
    bedListMock.mockResolvedValue({
      data: { results: [{ id: 21, name: 'Beet A', field: 10, area_sqm: 10 }] },
    });
    renderHierarchy();

    const widthCell = await screen.findByTestId('cell-21-width_m');
    fireEvent.keyDown(widthCell, { key: 'Enter' });

    expect(screen.getByTestId('mode-21')).toHaveTextContent('edit');
    expect(screen.getByTestId('focus-field-21')).toHaveTextContent('width_m');

    await user.click(screen.getByRole('button', { name: 'Width value 21' }));
    fireEvent.keyDown(widthCell, { key: 'Enter' });

    await waitFor(() => expect(bedUpdateMock).toHaveBeenCalledWith(
      21,
      expect.objectContaining({ width_m: 4 }),
    ));
    expect(screen.getByTestId('mode-21')).toHaveTextContent('view');
    await waitFor(() => expect(setCellFocusMock).toHaveBeenCalledWith(21, 'width_m'));
    expect(widthCell).toHaveFocus();
    expect(setCellFocusMock).not.toHaveBeenCalledWith(21, 'name');
  });

  it('keeps Enter independent from expansion and uses Space to toggle rows', async () => {
    useMultipleLocations();
    renderHierarchy();

    const locationNameCell = await screen.findByTestId('cell-location-1-name');
    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();

    fireEvent.keyDown(locationNameCell, { key: 'Enter' });
    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('edit');
    expect(screen.getByTestId('focus-field-location-1')).toHaveTextContent('name');
    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Escape location-1' }));
    fireEvent.keyDown(locationNameCell, { key: ' ' });
    await waitFor(() => expect(screen.queryByTestId('row-field-10')).not.toBeInTheDocument());

    fireEvent.keyDown(locationNameCell, { key: 'ArrowRight' });
    expect(screen.queryByTestId('row-field-10')).not.toBeInTheDocument();
  });

  it('does not toggle expansion or start rename from numeric-cell keyboard navigation', async () => {
    useMultipleLocations();
    renderHierarchy();

    const lengthCell = await screen.findByTestId('cell-field-10-length_m');
    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();

    fireEvent.keyDown(lengthCell, { key: ' ' });
    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();
    expect(screen.getByTestId('mode-field-10')).toHaveTextContent('view');

    expect(fireEvent.keyDown(lengthCell, { key: 'ArrowRight' })).toBe(true);
    expect(screen.getByTestId('mode-field-10')).toHaveTextContent('view');
  });

  it('deletes the focused row with Delete', async () => {
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    fireEvent.keyDown(await screen.findByTestId('cell-21-name'), { key: 'Delete' });

    await waitFor(() => expect(bedDeleteMock).toHaveBeenCalledWith(21));
    await waitFor(() => expect(screen.queryByTestId('row-21')).not.toBeInTheDocument());
  });

  it('creates a planting plan from a bed with Ctrl+Enter', async () => {
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    fireEvent.keyDown(await screen.findByTestId('cell-21-name'), { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(screen.getByTestId('current-route')).toHaveTextContent('/app/planting-plans?bedId=21'));
  });

  it('opens the complete row action menu with Shift+F10', async () => {
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    const bedNameCell = await screen.findByTestId('cell-21-name');
    fireEvent.keyDown(bedNameCell, { key: 'F10', shiftKey: true });

    expect(await screen.findByRole('menuitem', { name: 'Pflanzplan erstellen' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Löschen' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    fireEvent.keyDown(bedNameCell, { key: 'ContextMenu' });
    expect(await screen.findByRole('menuitem', { name: 'Pflanzplan erstellen' })).toBeInTheDocument();
  });

  it('keeps Standort name validation consistent with other hierarchy rows', async () => {
    const user = userEvent.setup();
    useMultipleLocations();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));
    await user.click(screen.getByRole('button', { name: 'Partial invalid location-1' }));
    await user.click(screen.getByRole('button', { name: 'Blur location-1' }));

    expect(await screen.findByText('Name ist ein Pflichtfeld')).toBeInTheDocument();
    expect(locationUpdateMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate field names within the same location before saving', async () => {
    const user = userEvent.setup();
    fieldListMock.mockResolvedValue({
      data: {
        results: [
          { id: 10, name: 'Teilweise gefuellt', location: 1, area_sqm: 20 },
          { id: 11, name: 'Suedfeld', location: 1, area_sqm: 20 },
        ],
      },
    });
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit field-11' }));
    await user.click(screen.getByRole('button', { name: 'Partial name field-11' }));
    await user.click(screen.getByRole('button', { name: 'Enter field-11' }));

    expect(await screen.findByText('Eine Parzelle mit diesem Namen existiert in diesem Standort bereits.')).toBeInTheDocument();
    expect(fieldUpdateMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate bed names within the same field before saving', async () => {
    const user = userEvent.setup();
    bedListMock.mockResolvedValue({
      data: {
        results: [
          { id: 21, name: 'Teilweise gefuellt', field: 10, area_sqm: 5 },
          { id: 22, name: 'Beet B', field: 10, area_sqm: 5 },
        ],
      },
    });
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit 22' }));
    await user.click(screen.getByRole('button', { name: 'Partial name 22' }));
    await user.click(screen.getByRole('button', { name: 'Enter 22' }));

    expect(await screen.findByText('Ein Beet mit diesem Namen existiert in dieser Parzelle bereits.')).toBeInTheDocument();
    expect(bedUpdateMock).not.toHaveBeenCalled();
  });

  it('cancels editing on an existing row with Escape without deleting data', async () => {
    const user = userEvent.setup();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit field-10' }));
    expect(screen.getByTestId('mode-field-10')).toHaveTextContent('edit');

    await user.click(screen.getByRole('button', { name: 'Escape field-10' }));

    expect(screen.getByTestId('mode-field-10')).toHaveTextContent('view');
    expect(fieldDeleteMock).not.toHaveBeenCalled();
    expect(screen.getByText('Nordfeld')).toBeInTheDocument();
  });

  it('cancels editing on an existing row when clicking outside without deleting data', async () => {
    const user = userEvent.setup();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit field-10' }));
    fireEvent.mouseDown(document.body);

    expect(screen.getByTestId('mode-field-10')).toHaveTextContent('view');
    expect(fieldDeleteMock).not.toHaveBeenCalled();
    expect(screen.getByText('Nordfeld')).toBeInTheDocument();
  });

  it('removes a completely empty newly created row with Escape', async () => {
    const user = userEvent.setup();
    renderHierarchy();
    await addNewBed();

    await user.click(screen.getByRole('button', { name: 'Escape -1700000000000' }));

    await waitFor(() => expect(screen.queryByTestId('row--1700000000000')).not.toBeInTheDocument());
    expect(screen.queryByText('Zeile wurde nicht gespeichert, da der Name fehlt.')).not.toBeInTheDocument();
  });

  it('keeps a partially filled new row available after Escape', async () => {
    const user = userEvent.setup();
    renderHierarchy();
    await addNewBed();

    await user.click(screen.getByRole('button', { name: 'Partial name -1700000000000' }));
    await user.click(screen.getByRole('button', { name: 'Escape -1700000000000' }));

    expect(screen.getByTestId('row--1700000000000')).toBeInTheDocument();
    expect(await screen.findByText('Teilweise gefuellt')).toBeInTheDocument();
    expect(screen.getByTestId('mode--1700000000000')).toHaveTextContent('view');
  });

  it('keeps a partially filled invalid new row local and does not persist it', async () => {
    const user = userEvent.setup();
    renderHierarchy();
    await addNewBed();

    await user.click(screen.getByRole('button', { name: 'Partial invalid -1700000000000' }));
    await user.click(screen.getByRole('button', { name: 'Escape -1700000000000' }));

    expect(screen.getByTestId('row--1700000000000')).toBeInTheDocument();
    expect(screen.getByText('Zeile wurde nicht gespeichert, da der Name fehlt.')).toBeInTheDocument();
    expect(bedCreateMock).not.toHaveBeenCalled();
    expect(mockUseNavigationBlocker).toHaveBeenLastCalledWith(
      true,
      'Es gibt eine nicht gespeicherte Zeile ohne Namen. Beim Verlassen der Seite geht sie verloren.',
    );
  });

  it('removes a completely empty new row when clicking outside', async () => {
    renderHierarchy();
    await addNewBed();

    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByTestId('row--1700000000000')).not.toBeInTheDocument());
    expect(screen.queryByText('Zeile wurde nicht gespeichert, da der Name fehlt.')).not.toBeInTheDocument();
  });

  it('keeps a partially filled new row available when clicking outside', async () => {
    const user = userEvent.setup();
    renderHierarchy();
    await addNewBed();

    await user.click(screen.getByRole('button', { name: 'Partial name -1700000000000' }));
    fireEvent.mouseDown(document.body);

    expect(screen.getByTestId('row--1700000000000')).toBeInTheDocument();
    expect(await screen.findByText('Teilweise gefuellt')).toBeInTheDocument();
    expect(screen.getByTestId('mode--1700000000000')).toHaveTextContent('view');
  });

  it('allows invalid missing-name edits to leave edit mode after validation fails', async () => {
    const user = userEvent.setup();
    renderHierarchy();
    await addNewBed();

    await user.click(screen.getByRole('button', { name: 'Partial invalid -1700000000000' }));
    await user.click(screen.getByRole('button', { name: 'Blur -1700000000000' }));
    expect(await screen.findByText('Zeile wurde nicht gespeichert, da der Name fehlt.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Escape -1700000000000' }));

    expect(screen.getByTestId('row--1700000000000')).toBeInTheDocument();
    expect(screen.getByTestId('mode--1700000000000')).toHaveTextContent('view');
    expect(screen.getByText('Zeile wurde nicht gespeichert, da der Name fehlt.')).toBeInTheDocument();
    expect(bedCreateMock).not.toHaveBeenCalled();
  });

  it('allows invalid missing-name edits to leave edit mode by clicking outside', async () => {
    const user = userEvent.setup();
    renderHierarchy();
    await addNewBed();

    await user.click(screen.getByRole('button', { name: 'Partial invalid -1700000000000' }));
    await user.click(screen.getByRole('button', { name: 'Blur -1700000000000' }));
    expect(await screen.findByText('Zeile wurde nicht gespeichert, da der Name fehlt.')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.getByTestId('row--1700000000000')).toBeInTheDocument();
    expect(screen.getByTestId('mode--1700000000000')).toHaveTextContent('view');
    expect(screen.getByText('Zeile wurde nicht gespeichert, da der Name fehlt.')).toBeInTheDocument();
    expect(bedCreateMock).not.toHaveBeenCalled();
  });

  it('removes unsaved invalid new rows on remount because they were never persisted', async () => {
    const user = userEvent.setup();
    const { unmount } = renderHierarchy();
    await addNewBed();

    await user.click(screen.getByRole('button', { name: 'Partial invalid -1700000000000' }));
    await user.click(screen.getByRole('button', { name: 'Escape -1700000000000' }));
    expect(screen.getByTestId('row--1700000000000')).toBeInTheDocument();
    expect(bedCreateMock).not.toHaveBeenCalled();

    unmount();
    renderHierarchy();

    await waitFor(() => expect(screen.queryByTestId('row--1700000000000')).not.toBeInTheDocument());
  });

  it('keeps hover actions rendered for invalid rows with empty required names', async () => {
    const user = userEvent.setup();
    renderHierarchy();
    await addNewBed();

    await user.click(screen.getByRole('button', { name: 'Partial invalid -1700000000000' }));
    await user.click(screen.getByRole('button', { name: 'Escape -1700000000000' }));

    expect(screen.queryByRole('button', { name: 'Aktionen' })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('row--1700000000000')).queryByRole('button', { name: 'Löschen' }),
    ).not.toBeInTheDocument();
  });

  it('opens hierarchy actions from the right-click context menu', async () => {
    useMultipleLocations();
    renderHierarchy();

    const locationRow = await screen.findByTestId('row-location-1');
    fireEvent.contextMenu(locationRow);

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Parzelle hinzufügen',
      'Bearbeiten',
      'Löschen',
      'common:actions.copyRow',
      'common:actions.copyTable',
    ]);
    expect(screen.getAllByRole('separator')).toHaveLength(3);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bearbeiten' }));
    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('edit');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Escape location-1' }));

    const fieldRow = await screen.findByTestId('row-field-10');
    fireEvent.contextMenu(fieldRow);

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Beet hinzufügen',
      'Bearbeiten',
      'Löschen',
      'common:actions.copyRow',
      'common:actions.copyTable',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Beet hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Beet' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(3);

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Bearbeiten' })).not.toBeInTheDocument());
    expect(within(fieldRow).queryByLabelText('Aktionen')).not.toBeInTheDocument();
    fireEvent.contextMenu(fieldRow);

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Beet hinzufügen',
      'Bearbeiten',
      'Löschen',
      'common:actions.copyRow',
      'common:actions.copyTable',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Beet hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Beet' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(3);
  });

  it('persists a deleted bed immediately and shows undo feedback', async () => {
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    const bedRow = await screen.findByTestId('row-21');
    deleteRowViaContextMenu(bedRow);

    await waitFor(() => expect(bedDeleteMock).toHaveBeenCalledWith(21));
    await waitFor(() => expect(screen.queryByTestId('row-21')).not.toBeInTheDocument());
    expect(screen.getByText('Beet gelöscht')).toBeInTheDocument();
    expect(screen.getByTestId('hierarchy-delete-snackbar')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: /Rückgängig: Beet gelöscht/i })).toBeInTheDocument();
  });

  it('removes a newly created empty bed locally without calling the delete API', async () => {
    renderHierarchy();
    await addNewBed();

    deleteRowViaContextMenu(screen.getByTestId('row--1700000000000'));

    await waitFor(() => expect(screen.queryByTestId('row--1700000000000')).not.toBeInTheDocument());
    expect(bedDeleteMock).not.toHaveBeenCalled();
    expect(fieldDeleteMock).not.toHaveBeenCalled();
    expect(locationDeleteMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Fehler beim Löschen')).not.toBeInTheDocument();
  });

  it('removes a newly created empty parcel locally without calling the delete API', async () => {
    fieldListMock.mockResolvedValue({ data: { results: [] } });
    renderHierarchyWithCreateFieldRequest(1);

    const fieldRow = await screen.findByTestId('row-field--1700000000000');
    deleteRowViaContextMenu(fieldRow);

    await waitFor(() => expect(screen.queryByTestId('row-field--1700000000000')).not.toBeInTheDocument());
    expect(fieldDeleteMock).not.toHaveBeenCalled();
    expect(bedDeleteMock).not.toHaveBeenCalled();
    expect(locationDeleteMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Fehler beim Löschen')).not.toBeInTheDocument();
  });

  it('deletes a bed through the inline hover action and shows undo feedback', async () => {
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    const bedRow = await screen.findByTestId('row-21');
    fireEvent.mouseDown(within(bedRow).getByRole('button', { name: 'Löschen' }));
    fireEvent.click(within(bedRow).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(bedDeleteMock).toHaveBeenCalledWith(21));
    await waitFor(() => expect(screen.queryByTestId('row-21')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Rückgängig: Beet gelöscht/i })).toBeInTheDocument();
  });

  it('restores a deleted bed when undo is clicked', async () => {
    const user = userEvent.setup();
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    const bedRow = await screen.findByTestId('row-21');
    deleteRowViaContextMenu(bedRow);
    await waitFor(() => expect(screen.queryByTestId('row-21')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Rückgängig: Beet gelöscht/i }));

    await waitFor(() => expect(bedCreateMock).toHaveBeenCalledWith({ name: 'Beet A', field: 10 }));
    expect(screen.getByTestId('row-21')).toBeInTheDocument();
    expect(bedDeleteMock).toHaveBeenCalledWith(21);
  });

  it('restores cascading field deletion with child beds on undo', async () => {
    const user = userEvent.setup();
    bedListMock.mockResolvedValue({
      data: {
        results: [
          { id: 21, name: 'Beet A', field: 10 },
          { id: 22, name: 'Beet B', field: 10 },
        ],
      },
    });
    renderHierarchy();

    const fieldRow = await screen.findByTestId('row-field-10');
    deleteRowViaContextMenu(fieldRow);

    await waitFor(() => expect(fieldDeleteMock).toHaveBeenCalledWith(10));
    await waitFor(() => expect(screen.queryByTestId('row-field-10')).not.toBeInTheDocument());
    expect(screen.queryByTestId('row-21')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-22')).not.toBeInTheDocument();
    expect(screen.getByText('Parzelle und {{count}} Beete gelöscht')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Rückgängig:/i }));

    await waitFor(() => expect(fieldCreateMock).toHaveBeenCalledWith({ name: 'Nordfeld', location: 1, area_sqm: 20 }));
    expect(bedCreateMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();
    expect(screen.getByTestId('row-21')).toBeInTheDocument();
    expect(screen.getByTestId('row-22')).toBeInTheDocument();
    expect(fieldDeleteMock).toHaveBeenCalledWith(10);
  });

  it('restores cascading location deletion with child fields and beds on undo', async () => {
    const user = userEvent.setup();
    locationListMock.mockResolvedValue({
      data: {
        results: [
          { id: 1, name: 'Hofstelle' },
          { id: 2, name: 'Außenfläche' },
        ],
      },
    });
    fieldListMock.mockResolvedValue({
      data: {
        results: [
          { id: 10, name: 'Nordfeld', location: 1, area_sqm: 20 },
          { id: 11, name: 'Suedfeld', location: 2, area_sqm: 12 },
        ],
      },
    });
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    const locationRow = await screen.findByTestId('row-location-1');
    deleteRowViaContextMenu(locationRow);

    await waitFor(() => expect(locationDeleteMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByTestId('row-location-1')).not.toBeInTheDocument());
    expect(screen.queryByTestId('row-field-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-21')).not.toBeInTheDocument();
    expect(screen.getByTestId('row-field-11')).toBeInTheDocument();
    expect(screen.getByText('Standort und {{count}} Beete gelöscht')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Rückgängig:/i }));

    await waitFor(() => expect(locationCreateMock).toHaveBeenCalledWith({ name: 'Hofstelle' }));
    expect(fieldCreateMock).toHaveBeenCalledWith({ name: 'Nordfeld', location: 301, area_sqm: 20 });
    expect(bedCreateMock).toHaveBeenCalledWith({ name: 'Beet A', field: 201 });
    expect(screen.getByTestId('row-location-1')).toBeInTheDocument();
    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();
    expect(screen.getByTestId('row-21')).toBeInTheDocument();
    expect(locationDeleteMock).toHaveBeenCalledWith(1);
  });

  it('handles multiple pending deletions independently', async () => {
    bedListMock.mockResolvedValue({
      data: {
        results: [
          { id: 21, name: 'Beet A', field: 10 },
          { id: 22, name: 'Beet B', field: 10 },
        ],
      },
    });
    renderHierarchy();

    const firstBedRow = await screen.findByTestId('row-21');
    deleteRowViaContextMenu(firstBedRow);
    await waitFor(() => expect(screen.queryByTestId('row-21')).not.toBeInTheDocument());
    deleteRowViaContextMenu(screen.getByTestId('row-22'));

    await waitFor(() => expect(screen.queryByTestId('row-22')).not.toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /Rückgängig:/i })).toHaveLength(2);
    expect(bedDeleteMock).toHaveBeenCalledWith(21);
    expect(bedDeleteMock).toHaveBeenCalledWith(22);

    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    fireEvent.click(screen.getAllByRole('button', { name: /Rückgängig:/i })[0]);
    await waitFor(() => expect(bedCreateMock).toHaveBeenCalledWith({ name: 'Beet A', field: 10 }));
    expect(screen.getByTestId('row-21')).toBeInTheDocument();
    expect(screen.queryByTestId('row-22')).not.toBeInTheDocument();
  });

  it('does not depend on pending deletion timers after unmount', async () => {
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    const { unmount } = renderHierarchy();

    const bedRow = await screen.findByTestId('row-21');
    deleteRowViaContextMenu(bedRow);
    await waitFor(() => expect(bedDeleteMock).toHaveBeenCalledWith(21));
    unmount();

    expect(bedDeleteMock).toHaveBeenCalledTimes(1);
  });
});
