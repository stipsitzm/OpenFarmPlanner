// Pure DOM-target helpers for EditableDataGrid's keyboard/pointer handling.
// Extracted from DataGrid.tsx; all functions only inspect the event target,
// they hold no grid state.
import type { GridRowId } from '@mui/x-data-grid';

export const editModeEditorArrowKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export const isComboboxInteractionTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('[role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]'),
  );
};

export const isEnterSaveInputTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement && !isComboboxInteractionTarget(target);

export const getRowIdFromElement = (target: EventTarget | null): GridRowId | null => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const rowElement = target.closest<HTMLElement>('[role="row"][data-id]');
  return rowElement?.dataset.id ?? null;
};
