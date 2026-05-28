import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GridColDef } from '@mui/x-data-grid';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FieldsBedsHierarchy, {
  isCompletelyEmptyNewHierarchyRow,
  isPartiallyFilledNamelessNewHierarchyRow,
} from '../pages/FieldsBedsHierarchy';
import { mockT } from './helpers/testI18n';

const {
  bedCreateMock,
  bedDeleteMock,
  bedListMock,
  bedUpdateMock,
  fieldDeleteMock,
  fieldListMock,
  fieldUpdateMock,
  locationDeleteMock,
  locationListMock,
  locationUpdateMock,
  mockUseNavigationBlocker,
  mockDrafts,
} = vi.hoisted(() => ({
  bedCreateMock: vi.fn(),
  bedDeleteMock: vi.fn(),
  bedListMock: vi.fn(),
  bedUpdateMock: vi.fn(),
  fieldDeleteMock: vi.fn(),
  fieldListMock: vi.fn(),
  fieldUpdateMock: vi.fn(),
  locationDeleteMock: vi.fn(),
  locationListMock: vi.fn(),
  locationUpdateMock: vi.fn(),
  mockUseNavigationBlocker: vi.fn(),
  mockDrafts: new Map<string, Record<string, unknown>>(),
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
      delete: fieldDeleteMock,
      list: fieldListMock,
      update: fieldUpdateMock,
    },
    locationAPI: {
      delete: locationDeleteMock,
      list: locationListMock,
      update: locationUpdateMock,
    },
  };
});

vi.mock('@mui/x-data-grid', async () => {
  const ReactModule = await import('react');
  const GridRowModes = { Edit: 'edit', View: 'view' };
  const GridRowEditStopReasons = {
    escapeKeyDown: 'escapeKeyDown',
    rowFocusOut: 'rowFocusOut',
  };

  const useGridApiRef = vi.fn(() => ({
    current: {
      getRowWithUpdatedValues: (id: string | number) => mockDrafts.get(String(id)) ?? null,
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
    onRowEditStop?: (params: { id: string | number; reason: string }, event: { defaultMuiPrevented: boolean }) => void;
    processRowUpdate?: (row: Record<string, unknown>) => Promise<Record<string, unknown>>;
    rowModesModel: Record<string, { mode: string }>;
    rows: Array<Record<string, unknown> & { id: string | number }>;
  }) => {
    if (apiRef?.current) {
      apiRef.current.getRowWithUpdatedValues = (id: string | number) => mockDrafts.get(String(id)) ?? null;
    }

    const commitBlur = async (row: Record<string, unknown> & { id: string | number }): Promise<void> => {
      const draft = mockDrafts.get(String(row.id)) ?? row;
      try {
        await processRowUpdate?.(draft);
      } catch (error) {
        onProcessRowUpdateError?.(error as Error);
      }
      onRowEditStop?.({ id: row.id, reason: GridRowEditStopReasons.rowFocusOut }, { defaultMuiPrevented: false });
    };

    return (
      <div data-testid="hierarchy-grid">
        <div data-testid="row-count">{rows.length}</div>
        {rows.map((row) => {
          const mode = rowModesModel[row.id]?.mode ?? rowModesModel[String(row.id)]?.mode ?? GridRowModes.View;
          return (
            <div data-id={String(row.id)} data-testid={`row-${row.id}`} key={String(row.id)} role="row">
              <span data-testid={`mode-${row.id}`}>{mode}</span>
              {columns.map((column) => {
                const editable = Boolean(column.editable) && (isCellEditable?.({ row, field: column.field }) ?? true);
                if (typeof column.renderCell === 'function') {
                  return (
                    <ReactModule.Fragment key={`${row.id}-${column.field}`}>
                      {column.renderCell({
                        api: {},
                        cellMode: mode === GridRowModes.Edit ? 'edit' : 'view',
                        field: column.field,
                        id: row.id,
                        row,
                        value: row[column.field],
                      } as never)}
                    </ReactModule.Fragment>
                  );
                }
                return (
                  <button
                    key={`${row.id}-${column.field}`}
                    type="button"
                    onClick={() => onCellClick?.({ id: row.id, field: column.field, isEditable: editable, row })}
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
                onClick={() =>
                  onCellKeyDown?.(
                    { id: row.id, field: 'name', isEditable: true, row },
                    { key: 'Escape', preventDefault: vi.fn(), defaultMuiPrevented: false } as unknown as React.KeyboardEvent,
                  )
                }
              >
                {`Escape ${row.id}`}
              </button>
              <button type="button" onClick={() => void commitBlur(row)}>
                {`Blur ${row.id}`}
              </button>
              <button type="button" onClick={() => void commitBlur(row)}>
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
    </MemoryRouter>,
  )
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

describe('FieldsBedsHierarchy edit cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDrafts.clear();
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hofstelle' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 10, name: 'Nordfeld', location: 1, area_sqm: 20 }] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });
    fieldUpdateMock.mockResolvedValue({ data: { id: 10, name: 'Nordfeld', location: 1, area_sqm: 20 } });
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

  it('enters inline edit mode when a Standort name is clicked', async () => {
    const user = userEvent.setup();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));

    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('edit');
  });

  it('cancels inline Standort editing with Escape without saving', async () => {
    const user = userEvent.setup();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));
    await user.click(screen.getByRole('button', { name: 'Escape location-1' }));

    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('view');
    expect(locationUpdateMock).not.toHaveBeenCalled();
  });

  it('saves inline Standort name edits through the shared row update flow', async () => {
    const user = userEvent.setup();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));
    await user.click(screen.getByRole('button', { name: 'Partial name location-1' }));
    await user.click(screen.getByRole('button', { name: 'Enter location-1' }));

    await waitFor(() => {
      expect(locationUpdateMock).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Teilweise gefuellt' }));
    });
  });

  it('keeps Standort name validation consistent with other hierarchy rows', async () => {
    const user = userEvent.setup();
    renderHierarchy();

    await user.click(await screen.findByRole('button', { name: 'Edit location-1' }));
    await user.click(screen.getByRole('button', { name: 'Partial invalid location-1' }));
    await user.click(screen.getByRole('button', { name: 'Blur location-1' }));

    expect(await screen.findByText('Name ist ein Pflichtfeld')).toBeInTheDocument();
    expect(locationUpdateMock).not.toHaveBeenCalled();
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

    expect(screen.getAllByRole('button', { name: 'Aktionen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
  });

  it('opens the same hierarchy actions from right click and the three-dots button', async () => {
    renderHierarchy();

    const locationRow = await screen.findByTestId('row-location-1');
    fireEvent.contextMenu(locationRow);

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Parzelle hinzufügen',
      'Bearbeiten',
      'Löschen',
    ]);
    expect(screen.getAllByRole('separator')).toHaveLength(2);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bearbeiten' }));
    expect(screen.getByTestId('mode-location-1')).toHaveTextContent('edit');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Escape location-1' }));

    const fieldRow = await screen.findByTestId('row-field-10');
    fireEvent.contextMenu(fieldRow);

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Beet hinzufügen',
      'Bearbeiten',
      'Löschen',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Beet hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Beet' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(2);

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Bearbeiten' })).not.toBeInTheDocument());
    fireEvent.click(within(fieldRow).getByLabelText('Aktionen'));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Beet hinzufügen',
      'Bearbeiten',
      'Löschen',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Beet hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Beet' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('removes a deleted bed immediately and finalizes after 8000 ms', async () => {
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    const bedRow = await screen.findByTestId('row-21');
    vi.useFakeTimers();
    deleteRowViaContextMenu(bedRow);

    expect(screen.queryByTestId('row-21')).not.toBeInTheDocument();
    expect(screen.getByText('Beet gelöscht')).toBeInTheDocument();
    expect(screen.getByTestId('hierarchy-delete-snackbar')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: /Rückgängig: Beet gelöscht/i })).toBeInTheDocument();
    expect(bedDeleteMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(7999);
    expect(bedDeleteMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(bedDeleteMock).toHaveBeenCalledWith(21);
    vi.useRealTimers();
  });

  it('restores a deleted bed when undo is clicked', async () => {
    const user = userEvent.setup();
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    renderHierarchy();

    const bedRow = await screen.findByTestId('row-21');
    deleteRowViaContextMenu(bedRow);
    expect(screen.queryByTestId('row-21')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Rückgängig: Beet gelöscht/i }));

    expect(screen.getByTestId('row-21')).toBeInTheDocument();
    expect(bedDeleteMock).not.toHaveBeenCalled();
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

    expect(screen.queryByTestId('row-field-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-21')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-22')).not.toBeInTheDocument();
    expect(screen.getByText('Parzelle und {{count}} Beete gelöscht')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Rückgängig:/i }));

    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();
    expect(screen.getByTestId('row-21')).toBeInTheDocument();
    expect(screen.getByTestId('row-22')).toBeInTheDocument();
    expect(fieldDeleteMock).not.toHaveBeenCalled();
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

    expect(screen.queryByTestId('row-location-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-field-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-21')).not.toBeInTheDocument();
    expect(screen.getByTestId('row-field-11')).toBeInTheDocument();
    expect(screen.getByText('Standort und {{count}} Beete gelöscht')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Rückgängig:/i }));

    expect(screen.getByTestId('row-location-1')).toBeInTheDocument();
    expect(screen.getByTestId('row-field-10')).toBeInTheDocument();
    expect(screen.getByTestId('row-21')).toBeInTheDocument();
    expect(locationDeleteMock).not.toHaveBeenCalled();
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
    vi.useFakeTimers();
    deleteRowViaContextMenu(firstBedRow);
    deleteRowViaContextMenu(screen.getByTestId('row-22'));

    expect(screen.queryByTestId('row-21')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-22')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Rückgängig:/i })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: /Rückgängig:/i })[0]);
    expect(screen.getByTestId('row-21')).toBeInTheDocument();
    expect(screen.queryByTestId('row-22')).not.toBeInTheDocument();

    vi.advanceTimersByTime(8000);
    await Promise.resolve();
    expect(bedDeleteMock).toHaveBeenCalledWith(22);
    expect(bedDeleteMock).not.toHaveBeenCalledWith(21);
    vi.useRealTimers();
  });

  it('cleans pending deletion timers on unmount', async () => {
    bedListMock.mockResolvedValue({ data: { results: [{ id: 21, name: 'Beet A', field: 10 }] } });
    const { unmount } = renderHierarchy();

    const bedRow = await screen.findByTestId('row-21');
    vi.useFakeTimers();
    deleteRowViaContextMenu(bedRow);
    unmount();
    vi.advanceTimersByTime(8000);

    expect(bedDeleteMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
