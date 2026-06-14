import type { Culture } from '../api/api';
import type { CultureSupplierData, CultureSupplierDataInput, SeedRateByCultivation, SeedRateUnit } from '../api/types';
import { isEmptySupplierDataRow } from '../cultures/supplierDataRows';
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

const mapSupplierDataRowToInput = (row: CultureSupplierData): CultureSupplierDataInput => ({
  id: row.id,
  supplier_id: row.supplier_id ?? row.supplier?.id ?? null,
  supplier_name_input: row.supplier_name_input,
  supplier_name: row.supplier_name ?? row.supplier?.name,
  supplier_product_name: row.supplier_product_name,
  supplier_product_url: row.supplier_product_url,
  packaging_sizes: row.packaging_sizes ?? [],
  germination_rate: row.germination_rate ?? null,
  price: row.price ?? null,
  notes: row.notes ?? '',
  source_url: row.source_url ?? '',
});

const isSetSeedRateValue = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const hasValue = (value: unknown): boolean => value !== null && value !== undefined;

const buildSeedRateByCultivation = (
  culture: Culture,
  cultivationTypes: Array<'pre_cultivation' | 'direct_sowing'>,
  legacyUnit: SeedRateUnit | null,
  directUnit: SeedRateUnit | null,
  preCultivationUnit: SeedRateUnit | null,
): {
  seed_rate_by_cultivation: SeedRateByCultivation | null;
  seed_rate_value: number | null;
  seed_rate_unit: SeedRateUnit | null;
} => {
  const hasMethodSpecificSeedRateInput = (
    hasValue(culture.seed_rate_direct_value)
    || hasValue(culture.seed_rate_direct_unit)
    || hasValue(culture.sowing_calculation_safety_percent_direct)
    || hasValue(culture.seed_rate_pre_cultivation_value)
    || hasValue(culture.seed_rate_pre_cultivation_unit)
    || hasValue(culture.sowing_calculation_safety_percent_pre_cultivation)
  );

  if (!hasMethodSpecificSeedRateInput) {
    return {
      seed_rate_by_cultivation: culture.seed_rate_by_cultivation ?? null,
      seed_rate_value: culture.seed_rate_value ?? null,
      seed_rate_unit: legacyUnit,
    };
  }

  const seedRateByCultivation: SeedRateByCultivation = {};

  if (
    cultivationTypes.includes('direct_sowing')
    && isSetSeedRateValue(culture.seed_rate_direct_value)
    && directUnit
  ) {
    seedRateByCultivation.direct_sowing = {
      value: culture.seed_rate_direct_value,
      unit: directUnit,
    };
  }

  if (
    cultivationTypes.includes('pre_cultivation')
    && isSetSeedRateValue(culture.seed_rate_pre_cultivation_value)
    && preCultivationUnit
  ) {
    seedRateByCultivation.pre_cultivation = {
      value: culture.seed_rate_pre_cultivation_value,
      unit: preCultivationUnit,
    };
  }

  const primarySeedRate = seedRateByCultivation.pre_cultivation ?? seedRateByCultivation.direct_sowing ?? null;

  return {
    seed_rate_by_cultivation: Object.keys(seedRateByCultivation).length > 0 ? seedRateByCultivation : null,
    seed_rate_value: primarySeedRate?.value ?? null,
    seed_rate_unit: primarySeedRate?.unit ?? null,
  };
};

export function buildCultureSavePayload(culture: Culture): CultureSavePayload {
  const supplierPayloadRows: CultureSupplierDataInput[] = [];
  if (Array.isArray(culture.supplier_data) && culture.supplier_data.length > 0) {
    supplierPayloadRows.push(
      ...culture.supplier_data
        .filter((row) => !isEmptySupplierDataRow(row))
        .map(mapSupplierDataRowToInput),
    );
  } else if (culture.supplier) {
    supplierPayloadRows.push({
      supplier_id: culture.supplier.id ?? null,
      supplier_name_input: culture.supplier.id ? undefined : culture.supplier.name,
      supplier_name: culture.supplier.name,
      supplier_product_url: culture.supplier_product_url ?? '',
      packaging_sizes: [],
    });
  }

  const cultivationTypes = (culture.cultivation_types && culture.cultivation_types.length > 0)
    ? culture.cultivation_types.filter((ct): ct is 'pre_cultivation' | 'direct_sowing' => ct === 'pre_cultivation' || ct === 'direct_sowing')
    : (culture.cultivation_type ? [normalizeCultivationType(culture.cultivation_type)].filter((ct): ct is 'pre_cultivation' | 'direct_sowing' => ct === 'pre_cultivation' || ct === 'direct_sowing') : ['pre_cultivation']);
  const seedRateDirectUnit = normalizeSeedRateUnit(culture.seed_rate_direct_unit);
  const seedRatePreCultivationUnit = normalizeSeedRateUnit(culture.seed_rate_pre_cultivation_unit);
  const seedRateFallbackFields = buildSeedRateByCultivation(
    culture,
    cultivationTypes,
    normalizeSeedRateUnit(culture.seed_rate_unit),
    seedRateDirectUnit,
    seedRatePreCultivationUnit,
  );

  const payload: CultureSavePayload = {
    ...culture,
    seed_packages: undefined,
    seed_rate_unit: seedRateFallbackFields.seed_rate_unit,
    seed_rate_direct_unit: seedRateDirectUnit,
    seed_rate_pre_cultivation_unit: seedRatePreCultivationUnit,
    harvest_method: normalizeHarvestMethod(culture.harvest_method),
    nutrient_demand: normalizeNutrientDemand(culture.nutrient_demand),
    cultivation_type: normalizeCultivationType(culture.cultivation_type),
    cultivation_types: cultivationTypes,
    seed_rate_value: seedRateFallbackFields.seed_rate_value,
    seed_rate_by_cultivation: seedRateFallbackFields.seed_rate_by_cultivation,
    seeding_requirement_type: normalizeSeedingRequirementType(culture.seeding_requirement_type),
    supplier_id: culture.supplier?.id || null,
    supplier_name: culture.supplier && !culture.supplier.id ? culture.supplier.name : undefined,
    supplier_data_input: supplierPayloadRows,
    supplier: undefined,
  };

  delete (payload as unknown as Record<string, unknown>).distance_within_row_m;
  delete (payload as unknown as Record<string, unknown>).row_spacing_m;
  delete (payload as unknown as Record<string, unknown>).sowing_depth_m;

  return payload;
}
