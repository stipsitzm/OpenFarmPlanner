import { useCallback, useMemo, useState } from 'react';
import type { GridColumnVisibilityModel } from '@mui/x-data-grid';

const COLUMN_VISIBILITY_PREFIX = 'tableColumns.';

function loadFromStorage(key: string): GridColumnVisibilityModel | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as GridColumnVisibilityModel;
    }
  } catch { /* ignore malformed data */ }
  return null;
}

export interface UseColumnVisibilityOptions {
  /** Identifies the table — used as the localStorage key suffix. */
  tableKey: string;
  /**
   * Default visibility model. Fields set to `false` are hidden by default.
   * Unmentioned fields are visible.
   */
  defaultVisibilityModel: GridColumnVisibilityModel;
  /**
   * Fields that are hidden by default but should auto-reveal on wide screens
   * when the user has no explicit saved preference.
   */
  wideScreenRevealFields?: string[];
  /** Pass `true` when the viewport is wide enough for the auto-reveal to apply. */
  isWideScreen?: boolean;
}

export function useColumnVisibility({
  tableKey,
  defaultVisibilityModel,
  wideScreenRevealFields = [],
  isWideScreen = false,
}: UseColumnVisibilityOptions): {
  columnVisibilityModel: GridColumnVisibilityModel;
  setColumnVisibilityModel: (model: GridColumnVisibilityModel) => void;
} {
  const storageKey = `${COLUMN_VISIBILITY_PREFIX}${tableKey}`;

  // null → no explicit user preference; a model object → user has saved a preference
  const [userModel, setUserModel] = useState<GridColumnVisibilityModel | null>(
    () => loadFromStorage(storageKey),
  );

  // Reactive computed model: user preference beats responsive auto-reveal
  const columnVisibilityModel = useMemo<GridColumnVisibilityModel>(() => {
    if (userModel !== null) return userModel;

    if (isWideScreen && wideScreenRevealFields.length > 0) {
      const model = { ...defaultVisibilityModel };
      for (const field of wideScreenRevealFields) {
        // Remove the explicit `false` → the column shows at its natural default
        delete model[field];
      }
      return model;
    }

    return defaultVisibilityModel;
  }, [userModel, isWideScreen, wideScreenRevealFields, defaultVisibilityModel]);

  const setColumnVisibilityModel = useCallback(
    (model: GridColumnVisibilityModel) => {
      setUserModel(model);
      localStorage.setItem(storageKey, JSON.stringify(model));
    },
    [storageKey],
  );

  return { columnVisibilityModel, setColumnVisibilityModel };
}
