/**
 * Custom hook for managing expansion state
 */

import { useState, useCallback } from 'react';
import type { GridRowId } from '@mui/x-data-grid';

export function useExpandedState() {
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

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

  return {
    expandedRows,
    toggleExpand,
    ensureExpanded,
  };
}
