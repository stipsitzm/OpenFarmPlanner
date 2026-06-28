/**
 * Navigation performance and correctness tests for FieldsBedsHierarchy.
 *
 * These tests verify:
 * 1. ArrowDown/Up navigation moves to the correct rows.
 * 2. Navigation does not produce cascading React re-renders (render count
 *    must equal key-press count, not a multiple).
 * 3. Rapid navigation stays within a generous timing budget so infinite
 *    loops or O(n²) regressions are caught early.
 *
 * Note: the DataGrid is mocked, so absolute durations here are much lower
 * than in the browser. The real-browser performance benefit comes from:
 *   – stable callbacks (handleDeleteSelected / handleEditSelected use refs)
 *   – stable areaCommands memo (no selectedRow in its dependency array)
 * Those changes mean fewer expensive re-renders per keypress in the browser.
 */

import React, { Profiler } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FieldsBedsHierarchy from '../pages/FieldsBedsHierarchy';
import { mockT } from './helpers/testI18n';

// ── mocks (mirrors FieldsBedsHierarchy.editCancel.test.tsx) ─────────────────

const {
  bedListMock,
  fieldListMock,
  locationListMock,
  getCapturedOnCellKeyDown,
  setCapturedOnCellKeyDown,
  getSelectRowImpl,
  setSelectRowImpl,
} = vi.hoisted(() => {
  // capturedOnCellKeyDown is set by the DataGrid mock each render so tests
  // can call the handler directly to verify blocking behaviour.
  let capturedOnCellKeyDown: ((params: unknown, event: unknown) => void) | undefined;
  // selectRowImpl bridges gridApiRef.current.selectRow() → DataGrid's React state.
  // DataGrid registers its setState on every render; useLayoutEffect calls it imperatively.
  let selectRowImpl: ((id: string | number, isSelected: boolean, reset: boolean) => void) | undefined;
  return {
    bedListMock: vi.fn(),
    fieldListMock: vi.fn(),
    locationListMock: vi.fn(),
    getCapturedOnCellKeyDown: () => capturedOnCellKeyDown,
    setCapturedOnCellKeyDown: (fn: ((params: unknown, event: unknown) => void) | undefined) => {
      capturedOnCellKeyDown = fn;
    },
    getSelectRowImpl: () => selectRowImpl,
    setSelectRowImpl: (fn: typeof selectRowImpl) => { selectRowImpl = fn; },
  };
});

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: mockT }) }));
vi.mock('../commands/useCommandContext', () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
}));
vi.mock('../hooks/autosave', () => ({ useNavigationBlocker: vi.fn() }));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    bedAPI: {
      create: vi.fn(),
      delete: vi.fn(),
      list: bedListMock,
      update: vi.fn(),
    },
    fieldAPI: {
      create: vi.fn(),
      delete: vi.fn(),
      list: fieldListMock,
      update: vi.fn(),
    },
    locationAPI: {
      create: vi.fn(),
      delete: vi.fn(),
      list: locationListMock,
      update: vi.fn(),
    },
  };
});

vi.mock('@mui/x-data-grid', async () => {
  const ReactModule = await import('react');
  const GridRowModes = { Edit: 'edit', View: 'view' };
  const GridRowEditStopReasons = { escapeKeyDown: 'escapeKeyDown', rowFocusOut: 'rowFocusOut' };
  const useGridApiRef = vi.fn(() => ({
    current: {
      setCellFocus: vi.fn(),
      // Route imperative selectRow calls into DataGrid's React state so tests
      // can assert data-selected without a controlled rowSelectionModel prop.
      selectRow: vi.fn((id: string | number, isSelected: boolean = true, resetOtherRows: boolean = false) => {
        getSelectRowImpl()?.(id, isSelected, resetOtherRows);
      }),
      setRowSelectionModel: vi.fn(),
    },
  }));

  const DataGrid = ({
    columns,
    isCellEditable,
    onCellClick,
    onCellKeyDown,
    rowModesModel,
    rows,
  }: {
    columns: Array<{ field: string; renderCell?: (p: unknown) => unknown; editable?: boolean }>;
    isCellEditable?: (p: { row: Record<string, unknown>; field: string }) => boolean;
    onCellClick?: (p: { id: string | number; field: string; isEditable: boolean; row: Record<string, unknown> }) => void;
    onCellKeyDown?: (params: unknown, event: unknown) => void;
    rowModesModel: Record<string, { mode: string }>;
    rows: Array<Record<string, unknown> & { id: string | number }>;
  }) => {
    const [selectedIds, setSelectedIds] = ReactModule.useState(new Set<string | number>());
    // Register state updater on every render so gridApiRef.current.selectRow() can
    // trigger a DataGrid re-render (mirrors MUI DataGrid's internal state update).
    setSelectRowImpl((id, isSelected, resetOtherRows) => {
      setSelectedIds(prev => {
        if (resetOtherRows) return isSelected ? new Set([id]) : new Set<string | number>();
        const next = new Set(prev);
        if (isSelected) next.add(id); else next.delete(id);
        return next;
      });
    });
    // Capture so tests can invoke it directly (e.g. letter-key guard test)
    setCapturedOnCellKeyDown(onCellKeyDown);
    return (
      <div data-testid="hierarchy-grid">
        <div data-testid="row-count">{rows.length}</div>
        {rows.map((row) => {
          const mode = rowModesModel[row.id]?.mode ?? rowModesModel[String(row.id)]?.mode ?? GridRowModes.View;
          const isSelected = selectedIds.has(row.id) || selectedIds.has(String(row.id));
          return (
            <div
              data-id={String(row.id)}
              data-testid={`row-${row.id}`}
              data-selected={isSelected ? 'true' : 'false'}
              key={String(row.id)}
              role="row"
            >
              <span data-testid={`mode-${row.id}`}>{mode}</span>
              <button
                type="button"
                data-testid={`select-${row.id}`}
                onClick={() => {
                  const editable = isCellEditable?.({ row, field: 'name' }) ?? true;
                  onCellClick?.({ id: row.id, field: 'name', isEditable: editable, row });
                }}
              >
                {`Select ${row.id}`}
              </button>
              {columns.map((col) => {
                if (typeof col.renderCell === 'function') {
                  return (
                    <ReactModule.Fragment key={`${row.id}-${col.field}`}>
                      {col.renderCell({
                        api: {},
                        cellMode: mode === GridRowModes.Edit ? 'edit' : 'view',
                        field: col.field,
                        id: row.id,
                        row,
                        value: row[col.field],
                      } as never)}
                    </ReactModule.Fragment>
                  );
                }
                return null;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return { DataGrid, GridRowEditStopReasons, GridRowModes, useGridApiRef };
});

// ── helpers ──────────────────────────────────────────────────────────────────

const FIELD_COUNT = 5;

const renderHierarchy = () =>
  render(
    <MemoryRouter initialEntries={['/app/fields-beds']}>
      <FieldsBedsHierarchy showTitle={false} />
    </MemoryRouter>,
  );

const renderHierarchyWithProfiler = (onRender: React.ProfilerOnRenderCallback) =>
  render(
    <Profiler id="fields-beds-hierarchy" onRender={onRender}>
      <MemoryRouter initialEntries={['/app/fields-beds']}>
        <FieldsBedsHierarchy showTitle={false} />
      </MemoryRouter>
    </Profiler>,
  );

const pressArrowDown = () =>
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });

const pressArrowUp = () =>
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); });

// ── tests ────────────────────────────────────────────────────────────────────

describe('FieldsBedsHierarchy keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    // jsdom does not implement scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    locationListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Standort A' }] },
    });
    fieldListMock.mockResolvedValue({
      data: {
        results: Array.from({ length: FIELD_COUNT }, (_, i) => ({
          id: i + 1,
          name: `Parzelle ${i + 1}`,
          location: 1,
          area_sqm: 10,
        })),
      },
    });
    bedListMock.mockResolvedValue({ data: { results: [] } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ArrowDown moves selection through consecutive rows', async () => {
    renderHierarchy();

    // Wait for rows to appear (fields are visible under the single location)
    await waitFor(() => expect(screen.getByTestId('row-field-1')).toBeInTheDocument());

    // Click the first field to select it and activate keyboard navigation
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-field-1'));
    });

    // Navigate down 4 rows
    await pressArrowDown();
    await pressArrowDown();
    await pressArrowDown();
    await pressArrowDown();

    // The 5th field (field-5) should now be selected
    await waitFor(() =>
      expect(screen.getByTestId('row-field-5')).toHaveAttribute('data-selected', 'true'),
    );
    // The first field should no longer be selected
    expect(screen.getByTestId('row-field-1')).toHaveAttribute('data-selected', 'false');
  });

  it('ArrowUp moves selection back up', async () => {
    renderHierarchy();
    await waitFor(() => expect(screen.getByTestId('row-field-1')).toBeInTheDocument());

    // Select field-5 first by clicking it
    await act(async () => { fireEvent.click(screen.getByTestId('select-field-5')); });

    await pressArrowUp();
    await pressArrowUp();

    await waitFor(() =>
      expect(screen.getByTestId('row-field-3')).toHaveAttribute('data-selected', 'true'),
    );
  });

  it('ArrowDown does not move past the last row', async () => {
    renderHierarchy();
    await waitFor(() => expect(screen.getByTestId(`row-field-${FIELD_COUNT}`)).toBeInTheDocument());

    // Select the last field
    await act(async () => {
      fireEvent.click(screen.getByTestId(`select-field-${FIELD_COUNT}`));
    });

    // Try to go further — should stay on the last field
    await pressArrowDown();
    await pressArrowDown();

    await waitFor(() =>
      expect(screen.getByTestId(`row-field-${FIELD_COUNT}`)).toHaveAttribute('data-selected', 'true'),
    );
  });

  it('ArrowUp does not move past the first row', async () => {
    renderHierarchy();
    // With a single location the hierarchy renders fields directly without a location header,
    // so field-1 is the first row in the flat list.
    await waitFor(() => expect(screen.getByTestId('row-field-1')).toBeInTheDocument());

    // Select the first field
    await act(async () => { fireEvent.click(screen.getByTestId('select-field-1')); });

    // Pressing up multiple times should keep field-1 selected
    await pressArrowUp();
    await pressArrowUp();

    await waitFor(() =>
      expect(screen.getByTestId('row-field-1')).toHaveAttribute('data-selected', 'true'),
    );
  });

  it(`${FIELD_COUNT} rapid ArrowDown presses cause at most ${FIELD_COUNT} React updates`, async () => {
    const updates: number[] = [];
    const onRender: React.ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
      if (phase === 'update') updates.push(actualDuration);
    };

    renderHierarchyWithProfiler(onRender);
    await waitFor(() => expect(screen.getByTestId('row-field-1')).toBeInTheDocument());

    const updatesBeforeNav = updates.length;

    // Activate navigation
    await act(async () => { fireEvent.click(screen.getByTestId('select-field-1')); });

    const updatesAfterClick = updates.length;

    // Navigate FIELD_COUNT - 1 times (stays within bounds)
    for (let i = 0; i < FIELD_COUNT - 1; i++) {
      await pressArrowDown();
    }

    const navUpdates = updates.length - updatesAfterClick;

    // Each ArrowDown triggers exactly 1 React update; no cascading allowed.
    expect(navUpdates).toBeLessThanOrEqual(FIELD_COUNT - 1);
    expect(navUpdates).toBeGreaterThan(0);

    // Sanity: initial load caused some renders too
    expect(updatesBeforeNav).toBeGreaterThanOrEqual(0);
  });

  it(`${FIELD_COUNT} ArrowDown presses complete within a generous jsdom budget`, async () => {
    renderHierarchy();
    await waitFor(() => expect(screen.getByTestId('row-field-1')).toBeInTheDocument());

    await act(async () => { fireEvent.click(screen.getByTestId('select-field-1')); });

    const start = performance.now();
    for (let i = 0; i < FIELD_COUNT - 1; i++) {
      await pressArrowDown();
    }
    const elapsed = performance.now() - start;

    // jsdom timing is noisy under parallel Vitest load. This guards against
    // infinite loops and O(n²) regressions, not browser interaction latency.
    expect(elapsed).toBeLessThan(5000);
  });

  it('collapsing a parent row while a child is selected moves selection to the parent and keeps navigation working', async () => {
    // Two fields, two beds under field-1.
    fieldListMock.mockResolvedValue({
      data: {
        results: [
          { id: 1, name: 'Parzelle 1', location: 1, area_sqm: 10 },
          { id: 2, name: 'Parzelle 2', location: 1, area_sqm: 10 },
        ],
      },
    });
    bedListMock.mockResolvedValue({
      data: {
        results: [
          { id: 101, name: 'Beet 1', field: 1, area_sqm: 5 },
          { id: 102, name: 'Beet 2', field: 1, area_sqm: 5 },
        ],
      },
    });

    renderHierarchy();

    // After auto-expand the beds should be visible under field-1.
    await waitFor(() => expect(screen.getByTestId('row-101')).toBeInTheDocument());

    // Select bed-101.
    await act(async () => { fireEvent.click(screen.getByTestId('select-101')); });
    expect(screen.getByTestId('row-101')).toHaveAttribute('data-selected', 'true');

    // Collapse field-1 by clicking its collapse button (rendered via renderCell).
    const collapseButton = within(screen.getByTestId('row-field-1')).getByRole('button', {
      name: 'Eintrag zuklappen',
    });
    await act(async () => { fireEvent.click(collapseButton); });

    // Beds should be gone; selection should jump to the collapsed parent (field-1).
    await waitFor(() => {
      expect(screen.queryByTestId('row-101')).not.toBeInTheDocument();
      expect(screen.getByTestId('row-field-1')).toHaveAttribute('data-selected', 'true');
    });

    // Navigation must still work after the collapse: ArrowDown should go to field-2.
    await pressArrowDown();
    await waitFor(() =>
      expect(screen.getByTestId('row-field-2')).toHaveAttribute('data-selected', 'true'),
    );
  });

  it('pressing a printable key while a row is selected does not start edit mode', async () => {
    renderHierarchy();
    await waitFor(() => expect(screen.getByTestId('row-field-1')).toBeInTheDocument());

    // Activate tree navigation via Alt+T. Unlike clicking a cell, this sets
    // selectedRowId and treeActive WITHOUT calling handleEditableCellClick, so
    // field-1 stays in view mode — the scenario where the letter-key guard matters.
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', altKey: true, bubbles: true }));
    });

    // field-1 is selected but NOT in edit mode.
    await waitFor(() =>
      expect(screen.getByTestId('row-field-1')).toHaveAttribute('data-selected', 'true'),
    );
    expect(screen.getByTestId('mode-field-1')).toHaveTextContent('view');

    // The DataGrid mock stores the onCellKeyDown prop so we can call it directly.
    const onCellKeyDown = getCapturedOnCellKeyDown();
    expect(onCellKeyDown).toBeDefined();

    // Simulate the event object that MUI passes to onCellKeyDown for the letter 'a'.
    const event = {
      key: 'a',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      defaultMuiPrevented: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    act(() => {
      onCellKeyDown!(
        { id: 'field-1', field: 'name', isEditable: true, row: {} },
        event,
      );
    });

    // The component must set defaultMuiPrevented so DataGrid does not start editing.
    expect(event.defaultMuiPrevented).toBe(true);
    // The row should remain in view mode (onCellKeyDown must not call setRowModesModel).
    expect(screen.getByTestId('mode-field-1')).toHaveTextContent('view');

    // Also verify that Alt+T (our navigation shortcut) is blocked.
    // MUI DataGrid v8's isPrintableKey() does not exclude altKey, so without our guard
    // pressing Alt+T while a cell has focus would start editing instead of navigating.
    const altTEvent = {
      key: 'T',
      ctrlKey: false,
      metaKey: false,
      altKey: true,
      shiftKey: false,
      defaultMuiPrevented: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    act(() => {
      onCellKeyDown!(
        { id: 'field-1', field: 'name', isEditable: true, row: {} },
        altTEvent,
      );
    });

    expect(altTEvent.defaultMuiPrevented).toBe(true);
    expect(screen.getByTestId('mode-field-1')).toHaveTextContent('view');
  });
});
