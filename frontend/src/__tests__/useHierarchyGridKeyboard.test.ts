import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GridRowModes } from '@mui/x-data-grid';
import type {
  GridCellParams,
  GridColDef,
  GridRowId,
  GridRowModesModel,
} from '@mui/x-data-grid';
import { useHierarchyGridKeyboard } from '../components/hierarchy/hooks/useHierarchyGridKeyboard';
import type { HierarchyRow } from '../components/hierarchy/utils/types';

type KeyboardEventStub = React.KeyboardEvent & {
  defaultMuiPrevented: boolean;
};

type MouseEventStub = React.MouseEvent<HTMLElement> & {
  defaultMuiPrevented: boolean;
};

const columns: GridColDef<HierarchyRow>[] = [
  { field: 'name', editable: true },
  { field: 'length_m', editable: true },
  { field: 'width_m', editable: true },
  { field: 'area_sqm', editable: false },
  { field: 'notes', editable: false },
];

const rows: HierarchyRow[] = [
  {
    id: 'field-1',
    type: 'field',
    name: 'Field 1',
    level: 0,
    hasChildren: true,
    isNew: false,
  },
  {
    id: 101,
    type: 'bed',
    name: 'Bed 1',
    level: 1,
    hasChildren: false,
    isNew: false,
  },
];

const rowsById = new Map(rows.map((row) => [String(row.id), row]));

const makeCellParams = (
  id: GridRowId,
  field: string,
  row = rowsById.get(String(id))!,
): GridCellParams<HierarchyRow> => ({
  id,
  field,
  row,
  isEditable: field === 'name' || field === 'length_m' || field === 'width_m',
}) as GridCellParams<HierarchyRow>;

const makeKeyboardEvent = (key: string, overrides: Partial<KeyboardEventStub> = {}): KeyboardEventStub => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  defaultMuiPrevented: false,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  currentTarget: document.createElement('div'),
  ...overrides,
}) as KeyboardEventStub;

const makeMouseEvent = (): MouseEventStub => ({
  defaultMuiPrevented: false,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
}) as unknown as MouseEventStub;

const renderKeyboardHook = (rowModesModel: GridRowModesModel = {}) => {
  const discardRowEdit = vi.fn();
  const focusCell = vi.fn();
  const notesOpen = vi.fn();
  const openContextMenu = vi.fn();
  const rememberFocusedField = vi.fn();
  const rememberRowSnapshot = vi.fn();
  const selectRow = vi.fn();
  const setEditCellValue = vi.fn().mockResolvedValue(true);
  const setRowModesModel = vi.fn();
  const setTreeActive = vi.fn();
  const toggleExpand = vi.fn();
  const scrollToIndexes = vi.fn();

  const api = {
    getAllRowIds: () => rows.map((row) => row.id),
    getCellParams: (id: GridRowId, field: string) => makeCellParams(id, field),
    getColumnIndexRelativeToVisibleColumns: (field: string) =>
      columns.findIndex((column) => column.field === field),
    getRowIndexRelativeToVisibleRows: (id: GridRowId) =>
      rows.findIndex((row) => String(row.id) === String(id)),
    getVisibleColumns: () => columns,
    isCellEditable: (params: GridCellParams<HierarchyRow>) =>
      params.field === 'name' || params.field === 'length_m' || params.field === 'width_m',
    scrollToIndexes,
    setCellFocus: focusCell,
    setEditCellValue,
  };

  const hook = renderHook(() =>
    useHierarchyGridKeyboard({
      columns,
      discardRowEdit,
      gridApiRef: { current: api },
      isCellFocusable: (row, field) => field === 'notes' || row.type !== 'location' && field !== 'area_sqm',
      isHierarchyCellAction: (params) => params.field === 'notes',
      notesEditor: { handleOpen: notesOpen },
      openContextMenuForRow: openContextMenu,
      rememberFocusedField,
      rememberRowSnapshot,
      rowModesModel,
      rows,
      rowsById,
      selectRow,
      setRowModesModel,
      setTreeActive,
      toggleExpand,
    }),
  );

  return {
    ...hook,
    discardRowEdit,
    focusCell,
    notesOpen,
    openContextMenu,
    rememberFocusedField,
    rememberRowSnapshot,
    scrollToIndexes,
    selectRow,
    setEditCellValue,
    setRowModesModel,
    setTreeActive,
    toggleExpand,
  };
};

describe('useHierarchyGridKeyboard', () => {
  it('skips the calculated area column when tabbing in edit mode', () => {
    const { result, focusCell, selectRow } = renderKeyboardHook({
      'field-1': { mode: GridRowModes.Edit },
    });
    const event = makeKeyboardEvent('Tab');

    act(() => {
      result.current.handleCellKeyDown(makeCellParams('field-1', 'width_m'), event);
    });

    expect(event.defaultMuiPrevented).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(focusCell).toHaveBeenCalledWith('field-1', 'notes');
    expect(focusCell).not.toHaveBeenCalledWith('field-1', 'area_sqm');
    expect(selectRow).toHaveBeenCalledWith('field-1');
  });

  it('starts edit mode from printable keys in view mode', async () => {
    const {
      result,
      focusCell,
      rememberRowSnapshot,
      selectRow,
      setEditCellValue,
      setRowModesModel,
      setTreeActive,
    } = renderKeyboardHook();
    const event = makeKeyboardEvent('a');

    act(() => {
      result.current.handleCellKeyDown(makeCellParams('field-1', 'name'), event);
    });

    expect(event.defaultMuiPrevented).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(focusCell).toHaveBeenCalledWith('field-1', 'name');
    expect(rememberRowSnapshot).toHaveBeenCalledWith('field-1');
    expect(selectRow).toHaveBeenCalledWith('field-1');
    expect(setTreeActive).toHaveBeenCalledWith(true);
    expect(setRowModesModel).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(setEditCellValue).toHaveBeenCalledWith({ id: 'field-1', field: 'name', value: 'a' });
    });
  });

  it('keeps fast typed numeric keys together when starting edit mode', async () => {
    const { result, setEditCellValue } = renderKeyboardHook();

    act(() => {
      result.current.handleCellKeyDown(makeCellParams('field-1', 'length_m'), makeKeyboardEvent('1'));
      result.current.handleCellKeyDown(makeCellParams('field-1', 'length_m'), makeKeyboardEvent('2'));
      result.current.handleCellKeyDown(makeCellParams('field-1', 'length_m'), makeKeyboardEvent('3'));
    });

    await waitFor(() => {
      expect(setEditCellValue).toHaveBeenCalledWith({ id: 'field-1', field: 'length_m', value: '123' });
    });
  });

  it('suppresses modified printable shortcuts in view mode without entering edit mode', () => {
    const { result, setRowModesModel } = renderKeyboardHook();
    const event = makeKeyboardEvent('T', { altKey: true });

    act(() => {
      result.current.handleCellKeyDown(makeCellParams('field-1', 'name'), event);
    });

    expect(event.defaultMuiPrevented).toBe(true);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(setRowModesModel).not.toHaveBeenCalled();
  });

  it('blocks non-focusable calculated-cell clicks before row selection or editing', () => {
    const { result, rememberRowSnapshot, selectRow, setRowModesModel } = renderKeyboardHook();
    const event = makeMouseEvent();

    act(() => {
      result.current.handleCellClick(makeCellParams('field-1', 'area_sqm'), event);
    });

    expect(event.defaultMuiPrevented).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(rememberRowSnapshot).not.toHaveBeenCalled();
    expect(selectRow).not.toHaveBeenCalled();
    expect(setRowModesModel).not.toHaveBeenCalled();
  });

  it('opens notes from the keyboard without starting row edit mode', () => {
    const { result, notesOpen, setRowModesModel } = renderKeyboardHook();
    const event = makeKeyboardEvent('Enter');

    act(() => {
      result.current.handleCellKeyDown(makeCellParams('field-1', 'notes'), event);
    });

    expect(event.defaultMuiPrevented).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(notesOpen).toHaveBeenCalledWith('field-1', 'notes');
    expect(setRowModesModel).not.toHaveBeenCalled();
  });

  it('discards the active row edit before clicking into another editable row', () => {
    const { result, discardRowEdit, selectRow, setRowModesModel } = renderKeyboardHook({
      'field-1': { mode: GridRowModes.Edit },
    });

    act(() => {
      result.current.handleCellClick(makeCellParams(101, 'name'), makeMouseEvent());
    });

    expect(discardRowEdit).toHaveBeenCalledWith('field-1');
    expect(selectRow).toHaveBeenCalledWith(101);
    expect(setRowModesModel).toHaveBeenCalledTimes(1);
  });

  it('uses spacebar for expandable rows and blocks default grid focus jumps for leaf rows', () => {
    const { result, toggleExpand } = renderKeyboardHook();
    const expandableEvent = makeKeyboardEvent(' ');
    const leafEvent = makeKeyboardEvent(' ');

    act(() => {
      result.current.handleCellKeyDown(makeCellParams('field-1', 'name'), expandableEvent);
      result.current.handleCellKeyDown(makeCellParams(101, 'name'), leafEvent);
    });

    expect(expandableEvent.defaultMuiPrevented).toBe(true);
    expect(expandableEvent.preventDefault).toHaveBeenCalled();
    expect(toggleExpand).toHaveBeenCalledWith('field-1');
    expect(leafEvent.defaultMuiPrevented).toBe(true);
    expect(leafEvent.preventDefault).toHaveBeenCalled();
    expect(toggleExpand).toHaveBeenCalledTimes(1);
  });
});
