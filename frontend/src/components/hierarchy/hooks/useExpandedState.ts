/**
 * Custom hook for managing expansion state
 */

import { useState, useCallback, useEffect } from 'react';
import type { GridRowId } from '@mui/x-data-grid';

const EXPANDED_STORAGE_PREFIX = 'hierarchyExpanded.';

const parseExpandedRows = (rawValue: string | null): Set<string | number> => {
  if (!rawValue) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(rawValue) as Array<string | number>;
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((item) => typeof item === 'string' || typeof item === 'number'));
  } catch {
    return new Set();
  }
};

export function useExpandedState(storageKey?: string) {
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(() => {
    if (!storageKey) {
      return new Set<string | number>();
    }

    return parseExpandedRows(window.sessionStorage.getItem(`${EXPANDED_STORAGE_PREFIX}${storageKey}`));
  });

  const hasPersistedState = expandedRows.size > 0;

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    window.sessionStorage.setItem(
      `${EXPANDED_STORAGE_PREFIX}${storageKey}`,
      JSON.stringify(Array.from(expandedRows))
    );
  }, [expandedRows, storageKey]);

  const toggleExpand = useCallback((rowId: GridRowId) => {
    setExpandedRows((prevExpanded) => {
      const newExpanded = new Set(prevExpanded);
      if (newExpanded.has(rowId)) {
        newExpanded.delete(rowId);
      } else {
        newExpanded.add(rowId);
      }
      return newExpanded;
    });
  }, []);

  const ensureExpanded = useCallback((rowId: string | number) => {
    setExpandedRows((prev) => {
      const newExpanded = new Set(prev);
      newExpanded.add(rowId);
      return newExpanded;
    });
  }, []);

  const expandAll = useCallback((rowIds: (string | number)[]) => {
    setExpandedRows(new Set(rowIds));
  }, []);

  return {
    expandedRows,
    hasPersistedState,
    toggleExpand,
    ensureExpanded,
    expandAll,
  };
}
