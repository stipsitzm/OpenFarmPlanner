import type { HierarchyRow } from './types';

const isEmptyHierarchyDraftValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  return false;
};

export const isCompletelyEmptyNewHierarchyRow = (row: HierarchyRow): boolean => {
  if (!row.isNew) {
    return false;
  }

  return (
    isEmptyHierarchyDraftValue(row.name) &&
    isEmptyHierarchyDraftValue(row.area_sqm) &&
    isEmptyHierarchyDraftValue(row.length_m) &&
    isEmptyHierarchyDraftValue(row.width_m) &&
    isEmptyHierarchyDraftValue(row.notes)
  );
};

export const isPartiallyFilledNamelessNewHierarchyRow = (row: HierarchyRow): boolean => (
  Boolean(row.isNew) &&
  isEmptyHierarchyDraftValue(row.name) &&
  !isCompletelyEmptyNewHierarchyRow(row)
);
