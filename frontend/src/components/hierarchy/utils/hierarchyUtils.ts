/**
 * Utility functions for building hierarchical data structures
 */

import type { Location, Field, Bed } from '../../../api/api';
import type { HierarchyRow } from './types';

/**
 * Build hierarchy rows from flat data
 */
export function buildHierarchyRows(
  locations: Location[],
  fields: Field[],
  beds: Bed[],
  expandedRows: Set<string | number>
): HierarchyRow[] {
  const hierarchyRows: HierarchyRow[] = [];

  // Check if we have multiple locations
  const hasMultipleLocations = locations.length > 1;

  if (hasMultipleLocations) {
    // Show locations as top level
    locations.forEach(location => {
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
      const locationFields = fields.filter(f => f.location === location.id);
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
        });

        if (!isFieldExpanded) return;

        // Add beds under this field
        const fieldBeds = beds.filter(b => b.field === field.id);
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
    fields.forEach(field => {
      const fieldKey = `field-${field.id}`;
      const isFieldExpanded = expandedRows.has(fieldKey);
      hierarchyRows.push({
        id: fieldKey,
        type: 'field',
        level: 0,
        name: field.name,
        fieldId: field.id,
        expanded: isFieldExpanded,
      });

      if (!isFieldExpanded) return;

      // Add beds under this field
      const fieldBeds = beds.filter(b => b.field === field.id);
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

  return hierarchyRows;
}
