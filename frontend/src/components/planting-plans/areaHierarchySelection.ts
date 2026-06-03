import type { Bed, Field } from '../../api/types';

export interface HierarchyAvailability {
  fieldIdsWithBeds: Set<number>;
  locationIdsWithBeds: Set<number>;
}

export const collectHierarchyAvailability = (
  fields: Field[],
  beds: Bed[],
): HierarchyAvailability => {
  const fieldIdsWithBeds = new Set<number>();
  beds.forEach((bed) => {
    if (typeof bed.field === 'number') {
      fieldIdsWithBeds.add(bed.field);
    }
  });

  const locationIdsWithBeds = new Set<number>();
  fields.forEach((field) => {
    if (field.id !== undefined && fieldIdsWithBeds.has(field.id)) {
      locationIdsWithBeds.add(field.location);
    }
  });

  return { fieldIdsWithBeds, locationIdsWithBeds };
};

export const filterFieldOptionsByLocation = (
  rowLocationId: number | null,
  fields: Field[],
  fieldIdsWithBeds: Set<number>,
): Field[] =>
  fields.filter((field) => {
    if (field.id === undefined || !fieldIdsWithBeds.has(field.id)) {
      return false;
    }
    return rowLocationId ? field.location === rowLocationId : true;
  });

export const filterBedOptionsBySelection = (
  rowLocationId: number | null,
  rowFieldId: number | null,
  fields: Field[],
  beds: Bed[],
  fieldIdsWithBeds: Set<number>,
): Bed[] =>
  beds.filter((bed) => {
    if (bed.id === undefined || !fieldIdsWithBeds.has(bed.field)) {
      return false;
    }
    if (rowFieldId) {
      return bed.field === rowFieldId;
    }
    if (rowLocationId) {
      const linkedField = fields.find((field) => field.id === bed.field);
      return linkedField?.location === rowLocationId;
    }
    return true;
  });
