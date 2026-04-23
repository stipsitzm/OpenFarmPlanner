/**
 * Utility functions for building hierarchical data structures
 */

import type { Location, Field, Bed } from '../../../api/api';

import type { HierarchyRow } from './types';

export interface HierarchySortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface HierarchyIndex {
  hasMultipleLocations: boolean;
  sortedLocations: Location[];
  sortedTopLevelFields: Field[];
  fieldsByLocation: Map<number, Field[]>;
  bedsByField: Map<number, Bed[]>;
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
      const leftArea = 'area_sqm' in left ? left.area_sqm : 0;
      const rightArea = 'area_sqm' in right ? right.area_sqm : 0;
      const numericResult = compareNumeric(leftArea, rightArea, sortConfig.direction);
      if (numericResult !== 0) {
        return numericResult;
      }
      return compareText(left.name ?? '', right.name ?? '', 'asc');
    }

    const textResult = compareText(left.name ?? '', right.name ?? '', sortConfig.direction);
    if (textResult !== 0) {
      return textResult;
    }

    const leftArea = 'area_sqm' in left ? left.area_sqm : 0;
    const rightArea = 'area_sqm' in right ? right.area_sqm : 0;
    return compareNumeric(leftArea, rightArea, 'asc');
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
  const index = buildHierarchyIndex(locations, fields, beds, sortConfig);
  return buildHierarchyRowsFromIndex(index, expandedRows);
}

export function buildHierarchyIndex(
  locations: Location[],
  fields: Field[],
  beds: Bed[],
  sortConfig?: HierarchySortConfig,
): HierarchyIndex {
  const sortedLocations = sortByConfig(locations, sortConfig);
  const sortedTopLevelFields = sortByConfig(fields, sortConfig);
  const fieldsByLocationUnsorted = new Map<number, Field[]>();
  const bedsByFieldUnsorted = new Map<number, Bed[]>();

  fields.forEach((field) => {
    const bucket = fieldsByLocationUnsorted.get(field.location) ?? [];
    bucket.push(field);
    fieldsByLocationUnsorted.set(field.location, bucket);
  });

  beds.forEach((bed) => {
    const bucket = bedsByFieldUnsorted.get(bed.field) ?? [];
    bucket.push(bed);
    bedsByFieldUnsorted.set(bed.field, bucket);
  });

  const fieldsByLocation = new Map<number, Field[]>();
  fieldsByLocationUnsorted.forEach((locationFields, locationId) => {
    fieldsByLocation.set(locationId, sortByConfig(locationFields, sortConfig));
  });

  const bedsByField = new Map<number, Bed[]>();
  bedsByFieldUnsorted.forEach((fieldBeds, fieldId) => {
    bedsByField.set(fieldId, sortByConfig(fieldBeds, sortConfig));
  });

  return {
    hasMultipleLocations: sortedLocations.length > 1,
    sortedLocations,
    sortedTopLevelFields,
    fieldsByLocation,
    bedsByField,
  };
}

export function buildHierarchyRowsFromIndex(
  hierarchyIndex: HierarchyIndex,
  expandedRows: Set<string | number>,
): HierarchyRow[] {
  const hierarchyRows: HierarchyRow[] = [];

  if (hierarchyIndex.hasMultipleLocations) {
    hierarchyIndex.sortedLocations.forEach((location) => {
      const locationKey = `location-${location.id}`;
      const isExpanded = expandedRows.has(locationKey);
      const locationFields =
        hierarchyIndex.fieldsByLocation.get(location.id) ?? [];
      hierarchyRows.push({
        id: locationKey,
        type: 'location',
        level: 0,
        name: location.name,
        locationId: location.id,
        expanded: isExpanded,
        hasChildren: locationFields.length > 0,
      });

      if (!isExpanded) return;

      locationFields.forEach((field) => {
        const fieldKey = `field-${field.id}`;
        const isFieldExpanded = expandedRows.has(fieldKey);
        const fieldBeds = hierarchyIndex.bedsByField.get(field.id) ?? [];
        hierarchyRows.push({
          id: fieldKey,
          type: 'field',
          level: 1,
          name: field.name,
          parentId: locationKey,
          locationId: location.id,
          fieldId: field.id,
          expanded: isFieldExpanded,
          hasChildren: fieldBeds.length > 0,
          area_sqm: field.area_sqm,
          length_m: field.length_m,
          width_m: field.width_m,
          notes: field.notes,
        });

        if (!isFieldExpanded) return;

        fieldBeds.forEach((bed) => {
          hierarchyRows.push({
            id: bed.id!,
            type: 'bed',
            level: 2,
            parentId: fieldKey,
            name: bed.name,
            field: bed.field,
            field_name: field.name,
            area_sqm: bed.area_sqm,
            length_m: bed.length_m,
            width_m: bed.width_m,
            notes: bed.notes,
            locationId: location.id,
            fieldId: field.id,
            bedId: bed.id,
            hasChildren: false,
            isNew: bed.id! < 0,
          });
        });
      });
    });

    return hierarchyRows;
  }

  hierarchyIndex.sortedTopLevelFields.forEach((field) => {
    const fieldKey = `field-${field.id}`;
    const isFieldExpanded = expandedRows.has(fieldKey);
    const fieldBeds = hierarchyIndex.bedsByField.get(field.id) ?? [];
    hierarchyRows.push({
      id: fieldKey,
      type: 'field',
      level: 0,
      name: field.name,
      fieldId: field.id,
      expanded: isFieldExpanded,
      hasChildren: fieldBeds.length > 0,
      area_sqm: field.area_sqm,
      length_m: field.length_m,
      width_m: field.width_m,
      notes: field.notes,
    });

    if (!isFieldExpanded) return;

    fieldBeds.forEach((bed) => {
      hierarchyRows.push({
        id: bed.id!,
        type: 'bed',
        level: 1,
        parentId: fieldKey,
        name: bed.name,
        field: bed.field,
        field_name: field.name,
        area_sqm: bed.area_sqm,
        length_m: bed.length_m,
        width_m: bed.width_m,
        notes: bed.notes,
        fieldId: field.id,
        bedId: bed.id,
        hasChildren: false,
        isNew: bed.id! < 0,
      });
    });
  });

  return hierarchyRows;
}
