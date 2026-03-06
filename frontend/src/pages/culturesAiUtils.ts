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
    culture.seed_rate_value,
    culture.seed_rate_unit,
    culture.thousand_kernel_weight_g,
    culture.nutrient_demand,
    culture.cultivation_type,
    culture.notes,
  ].some(isMissingValue);
}
