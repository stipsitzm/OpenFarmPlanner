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

export function normalizeCultivationType(
  value: unknown,
): CultivationType | undefined {
  if (value === 'pre_cultivation' || value === 'direct_sowing') {
    return value;
  }
  return undefined;
}

export function resolveCultivationTypeForAllowedOptions(
  allowedTypes: CultivationType[],
  currentValue?: unknown,
): CultivationType | '' {
  const normalizedCurrent = normalizeCultivationType(currentValue);
  if (normalizedCurrent && allowedTypes.includes(normalizedCurrent)) {
    return normalizedCurrent;
  }
  if (allowedTypes.length === 1) {
    return allowedTypes[0];
  }
  return '';
}
