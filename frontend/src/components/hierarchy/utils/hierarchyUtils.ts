/**
 * Utility functions for building hierarchical data structures
 */

import type { Location, Field, Bed } from '../../../api/api';

import type { HierarchyRow } from './types';

export interface HierarchySortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

const compareText = (left: string, right: string, direction: 'asc' | 'desc'): number => {
  const normalizedLeft = left.toLocaleLowerCase('de');
  const normalizedRight = right.toLocaleLowerCase('de');
  const result = normalizedLeft.localeCompare(normalizedRight, 'de');
  return direction === 'asc' ? result : -result;
};

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const compareNumeric = (left: unknown, right: unknown, direction: 'asc' | 'desc'): number => {
  const leftNumber = parseNumeric(left);
  const rightNumber = parseNumeric(right);

  if (leftNumber === null && rightNumber === null) return 0;
  if (leftNumber === null) return 1;
  if (rightNumber === null) return -1;

  const result = leftNumber - rightNumber;
  return direction === 'asc' ? result : -result;
};

const sortByConfig = <T extends Location | Field | Bed>(items: T[], sortConfig?: HierarchySortConfig): T[] => {
  if (!sortConfig) {
    return items;
  }

  const sorted = [...items];

  sorted.sort((left, right) => {
    if (sortConfig.field === 'area_sqm') {
      const numericResult = compareNumeric(left.area_sqm, right.area_sqm, sortConfig.direction);
      if (numericResult !== 0) {
        return numericResult;
      }
      return compareText(left.name ?? '', right.name ?? '', 'asc');
    }

    const textResult = compareText(left.name ?? '', right.name ?? '', sortConfig.direction);
    if (textResult !== 0) {
      return textResult;
    }

    return compareNumeric(left.area_sqm, right.area_sqm, 'asc');
  });

  return sorted;
};

/**
 * Build hierarchy rows from flat data
 */
export function buildHierarchyRows(
  locations: Location[],
  fields: Field[],
  beds: Bed[],
  expandedRows: Set<string | number>,
  sortConfig?: HierarchySortConfig
): HierarchyRow[] {
  const hierarchyRows: HierarchyRow[] = [];

  const sortedLocations = sortByConfig(locations, sortConfig);

  // Check if we have multiple locations
  const hasMultipleLocations = sortedLocations.length > 1;

  if (hasMultipleLocations) {
    // Show locations as top level
    sortedLocations.forEach(location => {
      const locationKey = `location-${location.id}`;
      const isExpanded = expandedRows.has(locationKey);
      hierarchyRows.push({
        id: locationKey,
        type: 'location',
        level: 0,
        name: location.name,
        locationId: location.id,
        expanded: isExpanded,
      });

      if (!isExpanded) return;

      // Add fields under this location
      const locationFields = sortByConfig(
        fields.filter(f => f.location === location.id),
        sortConfig
      );
      locationFields.forEach(field => {
        const fieldKey = `field-${field.id}`;
        const isFieldExpanded = expandedRows.has(fieldKey);
        hierarchyRows.push({
          id: fieldKey,
          type: 'field',
          level: 1,
          name: field.name,
          parentId: locationKey,
          locationId: location.id,
          fieldId: field.id,
          expanded: isFieldExpanded,
          area_sqm: field.area_sqm,
          notes: field.notes,
        });

        if (!isFieldExpanded) return;

        // Add beds under this field
        const fieldBeds = sortByConfig(
          beds.filter(b => b.field === field.id),
          sortConfig
        );
        fieldBeds.forEach(bed => {
          hierarchyRows.push({
            id: bed.id!,
            type: 'bed',
            level: 2,
            parentId: fieldKey,
            name: bed.name,
            field: bed.field,
            field_name: field.name,
            area_sqm: bed.area_sqm,
            notes: bed.notes,
            locationId: location.id,
            fieldId: field.id,
            bedId: bed.id,
            isNew: bed.id! < 0, // Mark as new if ID is negative
          });
        });
      });
    });
  } else {
    // Single location or no location - show fields as top level
    const sortedFields = sortByConfig(fields, sortConfig);
    sortedFields.forEach(field => {
      const fieldKey = `field-${field.id}`;
      const isFieldExpanded = expandedRows.has(fieldKey);
      hierarchyRows.push({
        id: fieldKey,
        type: 'field',
        level: 0,
        name: field.name,
        fieldId: field.id,
        expanded: isFieldExpanded,
        area_sqm: field.area_sqm,
        notes: field.notes,
      });

      if (!isFieldExpanded) return;

      // Add beds under this field
      const fieldBeds = sortByConfig(
        beds.filter(b => b.field === field.id),
        sortConfig
      );
      fieldBeds.forEach(bed => {
        hierarchyRows.push({
          id: bed.id!,
          type: 'bed',
          level: 1,
          parentId: fieldKey,
          name: bed.name,
          field: bed.field,
          field_name: field.name,
          area_sqm: bed.area_sqm,
          notes: bed.notes,
          fieldId: field.id,
          bedId: bed.id,
          isNew: bed.id! < 0, // Mark as new if ID is negative
        });
      });
    });
  }

  console.debug('[DEBUG] buildHierarchyRows: result', hierarchyRows);
  return hierarchyRows;
}
