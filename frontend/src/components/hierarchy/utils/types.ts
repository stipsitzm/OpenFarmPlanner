/**
 * Type definitions for hierarchical data grid
 */

/**
 * Combined row type for hierarchy
 */
export interface HierarchyRow {
  id: string | number;
  [key: string]: unknown;
  type: 'location' | 'field' | 'bed';
  level: number;
  expanded?: boolean;
  parentId?: string | number;
  // Bed fields
  name?: string;
  field?: number;
  field_name?: string;
  area_sqm?: number | string;
  notes?: string;
  // Location/Field metadata
  locationId?: number;
  fieldId?: number;
  bedId?: number;
  isNew?: boolean;
}
