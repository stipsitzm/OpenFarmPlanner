import { describe, expect, it, vi } from 'vitest';
import { focusKeyboardNavigableCell } from '../components/data-grid/keyboardNavigation';

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
