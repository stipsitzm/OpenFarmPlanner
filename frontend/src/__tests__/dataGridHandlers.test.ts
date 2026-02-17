import { describe, it, expect, vi } from 'vitest';
import { GridRowModes, GridRowEditStopReasons } from '@mui/x-data-grid';
import { handleEditableCellClick, handleRowEditStop } from '../components/data-grid/handlers';

describe('data-grid handlers', () => {
  it('enters edit mode when clicking editable cell', () => {
    const setRowModesModel = vi.fn((updater) => {
      const updated = updater({});
      expect(updated[1]).toEqual({ mode: GridRowModes.Edit, fieldToFocus: 'name' });
    });

    handleEditableCellClick(
      { id: 1, field: 'name', isEditable: true } as any,
      {},
      setRowModesModel,
    );

    expect(setRowModesModel).toHaveBeenCalledOnce();
  });

  it('does not change mode when clicking non-editable cell', () => {
    const setRowModesModel = vi.fn();

    handleEditableCellClick(
      { id: 1, field: 'name', isEditable: false } as any,
      {},
      setRowModesModel,
    );

    expect(setRowModesModel).not.toHaveBeenCalled();
  });

  it('prevents escape-stop but allows blur/tab/enter for autosave flow', () => {
    const escapeEvent = { defaultMuiPrevented: false };
    handleRowEditStop({ reason: GridRowEditStopReasons.escapeKeyDown } as any, escapeEvent as any);
    expect(escapeEvent.defaultMuiPrevented).toBe(true);

    const blurEvent = { defaultMuiPrevented: false };
    handleRowEditStop({ reason: GridRowEditStopReasons.rowFocusOut } as any, blurEvent as any);
    expect(blurEvent.defaultMuiPrevented).toBe(false);

    const enterEvent = { defaultMuiPrevented: false };
    handleRowEditStop({ reason: GridRowEditStopReasons.enterKeyDown } as any, enterEvent as any);
    expect(enterEvent.defaultMuiPrevented).toBe(false);

    const tabEvent = { defaultMuiPrevented: false };
    handleRowEditStop({ reason: GridRowEditStopReasons.tabKeyDown } as any, tabEvent as any);
    expect(tabEvent.defaultMuiPrevented).toBe(false);
  });
});
