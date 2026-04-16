import type { Culture, CultivationType } from '../api/types';

export function getAllowedCultivationTypesForCulture(
  culture?: Culture | null,
): CultivationType[] {
  const allowedValues = (
    culture?.cultivation_types?.length
      ? culture.cultivation_types
      : culture?.cultivation_type
        ? [culture.cultivation_type]
        : []
  ).filter(
    (value): value is CultivationType =>
      value === 'pre_cultivation' || value === 'direct_sowing',
  );

  if (allowedValues.length > 0) {
    return allowedValues;
  }

  return ['direct_sowing', 'pre_cultivation'];
}
