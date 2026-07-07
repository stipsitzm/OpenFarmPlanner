import { useCallback, useState } from 'react';
import type { GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid';

const COLUMN_VISIBILITY_PREFIX = 'tableColumns.';

interface StoredState {
  autofit: boolean;
  model: GridColumnVisibilityModel;
}

function loadFromStorage(key: string): StoredState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const obj = parsed as Record<string, unknown>;

    // Current format: { autofit: boolean, model: {...} }
    if ('autofit' in obj && 'model' in obj && obj.model !== null && typeof obj.model === 'object') {
      return {
        autofit: Boolean(obj.autofit),
        model: obj.model as GridColumnVisibilityModel,
      };
    }

    // Legacy format { model, customized }: treat as manual (autofit=false)
    if ('model' in obj && obj.model !== null && typeof obj.model === 'object') {
      return { autofit: false, model: obj.model as GridColumnVisibilityModel };
    }

    // Oldest legacy format: plain visibility model object
    return { autofit: false, model: obj as GridColumnVisibilityModel };
  } catch { /* ignore malformed data */ }
  return null;
}

function saveToStorage(key: string, state: StoredState): void {
  localStorage.setItem(key, JSON.stringify(state));
}

export interface UseColumnVisibilityOptions {
  tableKey: string;
}

export function useColumnVisibility({ tableKey }: UseColumnVisibilityOptions): {
  /** True when Autofit is active (default on first use). */
  autofitEnabled: boolean;
  /** The user's manually-saved visibility model (used when autofitEnabled=false). */
  columnVisibilityModel: GridColumnVisibilityModel;
  /**
   * Save a manual column visibility model and disable Autofit.
   * Call this when the user explicitly toggles a column.
   */
  setManualColumnVisibility: (model: GridColumnVisibilityModel) => void;
  /**
   * Enable or disable Autofit.
   * When enabling: resumes auto-hide/show based on container width.
   * When disabling: call setManualColumnVisibility instead so the current
   * effective model is captured at the same time.
   */
  setAutofitEnabled: (enabled: boolean) => void;
} {
  const storageKey = `${COLUMN_VISIBILITY_PREFIX}${tableKey}`;

  const [savedState, setSavedState] = useState<StoredState>(
    () => loadFromStorage(storageKey) ?? { autofit: true, model: {} },
  );

  const setManualColumnVisibility = useCallback(
    (model: GridColumnVisibilityModel) => {
      const next: StoredState = { autofit: false, model };
      setSavedState(next);
      saveToStorage(storageKey, next);
    },
    [storageKey],
  );

  const setAutofitEnabled = useCallback(
    (enabled: boolean) => {
      setSavedState((prev) => {
        const next: StoredState = { ...prev, autofit: enabled };
        saveToStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return {
    autofitEnabled: savedState.autofit,
    columnVisibilityModel: savedState.model,
    setManualColumnVisibility,
    setAutofitEnabled,
  };
}

/**
 * Pure utility: hides columns in `autoHidePriority` order until the total
 * minimum column width fits within `availableWidth`.
 *
 * - Returns `{}` (all visible) when all columns fit.
 * - Returns `fallbackModel` when `availableWidth <= 0` (not yet measured).
 *
 * Suitable for use in `useMemo`.
 *
 * @param columns         All rendered column definitions.
 * @param autoHidePriority Fields to hide, from first-to-hide to last-to-hide.
 * @param availableWidth  Container width in pixels (from ResizeObserver).
 * @param fallbackModel   Model to use before the first measurement fires.
 */
export function computeAutoFitColumnVisibility(
  columns: GridColDef[],
  autoHidePriority: string[],
  availableWidth: number,
  fallbackModel: GridColumnVisibilityModel = {},
): GridColumnVisibilityModel {
  if (availableWidth <= 0) return fallbackModel;

  const getColMinWidth = (col: GridColDef): number =>
    col.minWidth ?? (typeof col.width === 'number' ? col.width : 0) ?? 50;

  let remaining = columns.reduce((sum, col) => sum + getColMinWidth(col), 0);

  if (remaining <= availableWidth) return {};

  const model: GridColumnVisibilityModel = {};
  for (const field of autoHidePriority) {
    if (remaining <= availableWidth) break;
    model[field] = false;
    const col = columns.find(c => c.field === field);
    if (col) remaining -= getColMinWidth(col);
  }

  return model;
}
