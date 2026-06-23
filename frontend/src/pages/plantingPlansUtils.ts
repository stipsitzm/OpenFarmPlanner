import type { Culture, CultivationType } from '../api/types';
import { formatLocalizedNumber } from '../utils/numberLocalization';

export const AREA_LABEL_SEPARATOR = ' | ';

export const toNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

export const formatAreaM2 = (value: number, locale: string): string =>
  `${formatLocalizedNumber(value, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

export const buildAreaColumnHeaderLabel = (
  includeLocation: boolean,
  locationLabel: string,
  fieldLabel: string,
  bedLabel: string,
): string =>
  includeLocation
    ? `${locationLabel}${AREA_LABEL_SEPARATOR}${fieldLabel}${AREA_LABEL_SEPARATOR}${bedLabel}`
    : `${fieldLabel}${AREA_LABEL_SEPARATOR}${bedLabel}`;

export const buildBedDisplayLabel = (
  locationName: string | null | undefined,
  fieldName: string | null | undefined,
  bedName: string | null | undefined,
  areaSqm: number | null,
  includeLocation: boolean,
  locale: string,
): string => {
  const normalizedLocationName = (locationName ?? '').trim();
  const normalizedBedName = (bedName ?? '').trim();
  const normalizedFieldName = (fieldName ?? '').trim();
  const combinedName = [
    includeLocation ? normalizedLocationName : '',
    normalizedFieldName,
    normalizedBedName,
  ]
    .filter((part) => part.length > 0)
    .join(AREA_LABEL_SEPARATOR);

  if (!combinedName) return '—';
  if (areaSqm === null) return combinedName;
  return `${combinedName} (${formatAreaM2(areaSqm, locale)})`;
};

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
