import { useCallback, useMemo, useState } from 'react';
import type { GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid';

const COLUMN_VISIBILITY_PREFIX = 'tableColumns.';

interface StoredState {
  model: GridColumnVisibilityModel;
  customized: boolean;
}

function loadFromStorage(key: string): StoredState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const obj = parsed as Record<string, unknown>;

    // New format: { model: {...}, customized: boolean }
    if ('model' in obj && obj.model !== null && typeof obj.model === 'object' && !Array.isArray(obj.model)) {
      return {
        model: obj.model as GridColumnVisibilityModel,
        customized: Boolean(obj.customized),
      };
    }

    // Legacy format: plain visibility model — treat as user-customized to preserve prior behaviour
    return { model: obj as GridColumnVisibilityModel, customized: true };
  } catch { /* ignore malformed data */ }
  return null;
}

export interface UseColumnVisibilityOptions {
  /** Identifies the table — used as the localStorage key suffix. */
  tableKey: string;
  /**
   * Fallback model used before the container is first measured and when no
   * saved state exists. Set fields you want hidden by default on narrow screens.
   */
  defaultVisibilityModel?: GridColumnVisibilityModel;
}

export function useColumnVisibility({
  tableKey,
  defaultVisibilityModel = {},
}: UseColumnVisibilityOptions): {
  /** The user-saved (or default) visibility model. */
  columnVisibilityModel: GridColumnVisibilityModel;
  /** Call on explicit user action; marks the config as user-customized. */
  setColumnVisibilityModel: (model: GridColumnVisibilityModel) => void;
  /** True once the user has made at least one explicit change. Disables auto-fit. */
  isUserCustomized: boolean;
} {
  const storageKey = `${COLUMN_VISIBILITY_PREFIX}${tableKey}`;

  const [savedState, setSavedState] = useState<StoredState | null>(
    () => loadFromStorage(storageKey),
  );

  const columnVisibilityModel = useMemo<GridColumnVisibilityModel>(
    () => savedState?.model ?? defaultVisibilityModel,
    [savedState, defaultVisibilityModel],
  );

  const isUserCustomized = savedState?.customized ?? false;

  const setColumnVisibilityModel = useCallback(
    (model: GridColumnVisibilityModel) => {
      const state: StoredState = { model, customized: true };
      setSavedState(state);
      localStorage.setItem(storageKey, JSON.stringify(state));
    },
    [storageKey],
  );

  return { columnVisibilityModel, setColumnVisibilityModel, isUserCustomized };
}

/**
 * Determines which columns to hide so the table fits within `availableWidth`
 * without a horizontal scroll bar.
 *
 * Columns in `autoHidePriority` are hidden in order (index 0 = first to hide)
 * until the summed minimum widths fit. Returns `{}` when all columns already fit.
 * Returns `fallbackModel` when `availableWidth` is 0 (not yet measured).
 *
 * This is a pure function suitable for use in `useMemo`.
 *
 * @param columns         Full column definitions (including any fixed action columns).
 * @param autoHidePriority Fields to hide in priority order.
 * @param availableWidth  Available container width in pixels.
 * @param fallbackModel   Model to return when availableWidth is not yet known.
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

  // All columns fit — show everything
  if (remaining <= availableWidth) return {};

  // Hide in priority order until the total fits
  const model: GridColumnVisibilityModel = {};
  for (const field of autoHidePriority) {
    if (remaining <= availableWidth) break;
    model[field] = false;
    const col = columns.find(c => c.field === field);
    if (col) remaining -= getColMinWidth(col);
  }

  return model;
}
