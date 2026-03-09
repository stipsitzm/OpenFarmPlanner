import type { Culture } from '../api/api';
import {
  normalizeCultivationType,
  normalizeHarvestMethod,
  normalizeNutrientDemand,
  normalizeSeedingRequirementType,
  normalizeSeedRateUnit,
} from '../cultures/enumNormalization';

export type CultureSavePayload = Culture & {
  supplier_id: number | null;
  supplier_name?: string;
  supplier?: undefined;
};

export function buildCultureSavePayload(culture: Culture): CultureSavePayload {
  const normalizedSeedPackages = Array.isArray(culture.seed_packages)
    ? culture.seed_packages.map((pkg) => ({
        size_value: Math.round((Number(pkg.size_value) || 0) * 10) / 10,
        size_unit: 'g' as const,
        evidence_text: pkg.evidence_text ?? '',
        last_seen_at: pkg.last_seen_at ?? null,
      }))
    : culture.seed_packages;

  const payload: CultureSavePayload = {
    ...culture,
    seed_packages: normalizedSeedPackages,
    seed_rate_unit: normalizeSeedRateUnit(culture.seed_rate_unit),
    harvest_method: normalizeHarvestMethod(culture.harvest_method),
    nutrient_demand: normalizeNutrientDemand(culture.nutrient_demand),
    cultivation_type: normalizeCultivationType(culture.cultivation_type),
    cultivation_types: (culture.cultivation_types && culture.cultivation_types.length > 0)
      ? culture.cultivation_types.filter((ct): ct is 'pre_cultivation' | 'direct_sowing' => ct === 'pre_cultivation' || ct === 'direct_sowing')
      : (culture.cultivation_type ? [normalizeCultivationType(culture.cultivation_type)].filter((ct): ct is 'pre_cultivation' | 'direct_sowing' => ct === 'pre_cultivation' || ct === 'direct_sowing') : ['pre_cultivation']),
    seed_rate_by_cultivation: culture.seed_rate_by_cultivation ?? null,
    seeding_requirement_type: normalizeSeedingRequirementType(culture.seeding_requirement_type),
    supplier_id: culture.supplier?.id || null,
    supplier_name: culture.supplier && !culture.supplier.id ? culture.supplier.name : undefined,
    supplier: undefined,
  };

  delete (payload as unknown as Record<string, unknown>).distance_within_row_m;
  delete (payload as unknown as Record<string, unknown>).row_spacing_m;
  delete (payload as unknown as Record<string, unknown>).sowing_depth_m;

  return payload;
}
