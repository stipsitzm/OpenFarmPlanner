import { describe, expect, it, vi } from 'vitest';
import {
  focusKeyboardNavigableCell,
  resolveFocusedCellFromEvent,
} from '../components/data-grid/keyboardNavigation';

describe('keyboardNavigation', () => {
  it('focuses the edit input inside a focused editable cell', () => {
    const cellElement = document.createElement('div');
    const input = document.createElement('input');
    cellElement.append(input);
    document.body.append(cellElement);

    const api = {
      getCellElement: vi.fn(() => cellElement),
      getColumnIndexRelativeToVisibleColumns: vi.fn(() => 1),
      getRowIndexRelativeToVisibleRows: vi.fn(() => 0),
      scrollToIndexes: vi.fn(),
      setCellFocus: vi.fn(),
    };

    focusKeyboardNavigableCell({
      api,
      cell: { id: 1, field: 'width_m' },
      focusEditInput: true,
    });

    expect(api.scrollToIndexes).toHaveBeenCalledWith({ rowIndex: 0, colIndex: 1 });
    expect(api.setCellFocus).toHaveBeenCalledWith(1, 'width_m');
    expect(document.activeElement).toBe(input);

    cellElement.remove();
  });
});

describe('resolveFocusedCellFromEvent', () => {
  it('prefers the grid focus state when a cell is tracked', () => {
    const api = { state: { focus: { cell: { id: 7, field: 'width_m' } } } };

    const result = resolveFocusedCellFromEvent(api, { target: null });

    expect(result).toEqual({ id: 7, field: 'width_m' });
  });

  it('falls back to the event target DOM and parses a numeric row id', () => {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    row.dataset.id = '42';
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    cell.dataset.field = 'name';
    row.append(cell);

    const result = resolveFocusedCellFromEvent(null, { target: cell });

    expect(result).toEqual({ id: 42, field: 'name' });
  });

  it('keeps a non-numeric row id as a string', () => {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    row.dataset.id = 'draft-1';
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    cell.dataset.field = 'name';
    row.append(cell);

    expect(resolveFocusedCellFromEvent(null, { target: cell })).toEqual({
      id: 'draft-1',
      field: 'name',
    });
  });

  it('returns null when the target is not resolvable to a cell', () => {
    expect(resolveFocusedCellFromEvent(null, { target: null })).toBeNull();
    expect(
      resolveFocusedCellFromEvent(undefined, { target: document.createElement('span') }),
    ).toBeNull();
  });
});
