import type { Culture } from '../api/api';

function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  return false;
}

export function canRunEnrichmentForCulture(culture?: Culture | null): boolean {
  return Boolean(culture?.supplier && (culture.supplier.allowed_domains || []).length > 0);
}

export function cultureHasMissingEnrichmentFields(culture: Culture): boolean {
  const cultivationTypes = culture.cultivation_types ?? (culture.cultivation_type ? [culture.cultivation_type] : []);
  const directSeedMissing = cultivationTypes.includes('direct_sowing')
    ? isMissingValue(culture.seed_rate_direct_value) || isMissingValue(culture.seed_rate_direct_unit)
    : false;
  const preCultivationSeedMissing = cultivationTypes.includes('pre_cultivation')
    ? isMissingValue(culture.seed_rate_pre_cultivation_value) || isMissingValue(culture.seed_rate_pre_cultivation_unit)
    : false;

  return [
    culture.growth_duration_days,
    culture.harvest_duration_days,
    culture.propagation_duration_days,
    culture.harvest_method,
    culture.expected_yield,
    culture.seed_packages,
    culture.distance_within_row_cm,
    culture.row_spacing_cm,
    culture.sowing_depth_cm,
    directSeedMissing ? null : 'ok',
    preCultivationSeedMissing ? null : 'ok',
    culture.thousand_kernel_weight_g,
    culture.nutrient_demand,
    culture.cultivation_type,
    culture.notes,
  ].some(isMissingValue);
}
