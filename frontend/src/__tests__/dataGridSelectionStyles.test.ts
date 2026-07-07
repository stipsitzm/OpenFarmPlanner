import { dataGridSx } from '../components/data-grid/styles';

/**
 * Row "selection" in EditableDataGrid only tracks which row keyboard
 * shortcuts (delete/duplicate/edit) act on — it must never paint a
 * persistent highlight. Only genuine hover (or the cell focus ring) may
 * highlight a row. These are static assertions on the style object because
 * jsdom doesn't reliably compute MUI DataGrid's runtime emotion styles.
 */
describe('dataGridSx selected-row styling', () => {
  const selectedRowKeys = Object.keys(dataGridSx).filter((key) => key.includes('Mui-selected'));

  it('defines selected-row rules to guard against regressions', () => {
    expect(selectedRowKeys.length).toBeGreaterThan(0);
  });

  it('never paints a persistent (non-hover) background for a selected row', () => {
    const nonHoverSelectedKeys = selectedRowKeys.filter((key) => !key.includes(':hover'));
    expect(nonHoverSelectedKeys.length).toBeGreaterThan(0);

    for (const key of nonHoverSelectedKeys) {
      const rule = (dataGridSx as Record<string, { backgroundColor?: unknown; bgcolor?: unknown }>)[key];
      const background = rule.backgroundColor ?? rule.bgcolor;
      expect(background, `rule for "${key}" must not use action.selected`).not.toBe('action.selected');
    }
  });

  it('restores the normal hover background when a selected row is actually hovered', () => {
    const hoverSelectedKeys = selectedRowKeys.filter((key) => key.includes(':hover'));
    expect(hoverSelectedKeys.length).toBeGreaterThan(0);

    for (const key of hoverSelectedKeys) {
      const rule = (dataGridSx as Record<string, { backgroundColor?: unknown; bgcolor?: unknown }>)[key];
      const background = rule.backgroundColor ?? rule.bgcolor;
      expect(background).not.toBe('action.selected');
      expect(background).not.toBe('transparent');
    }
  });

  it('keeps the cell focus ring (box-shadow) on a focused cell inside a selected row', () => {
    const focusKey = selectedRowKeys.find((key) => key.includes(':focus'));
    expect(focusKey).toBeDefined();
    const rule = (dataGridSx as Record<string, { boxShadow?: unknown }>)[focusKey as string];
    expect(rule.boxShadow).toBeTypeOf('function');
  });

  it('does not clobber the edit-mode row tint for a row that is both selected and being edited', () => {
    for (const key of selectedRowKeys) {
      expect(key).toContain(':not(.MuiDataGrid-row--editing)');
    }
  });
});
