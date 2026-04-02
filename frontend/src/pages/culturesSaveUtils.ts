import type { Culture } from '../api/api';
import type { CultureSupplierDataInput } from '../api/types';
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
  const supplierPayloadRows: CultureSupplierDataInput[] = [];
  if (Array.isArray(culture.supplier_data) && culture.supplier_data.length > 0) {
    supplierPayloadRows.push(...culture.supplier_data.map((row) => ({
      supplier_id: row.supplier?.id ?? row.supplier_id ?? null,
      supplier_name_input: row.supplier_name_input,
      supplier_name: row.supplier_name ?? row.supplier?.name,
      supplier_product_name: row.supplier_product_name,
      supplier_product_url: row.supplier_product_url,
      packaging_sizes: row.packaging_sizes ?? [],
      thousand_kernel_weight_g: row.thousand_kernel_weight_g ?? null,
      germination_rate: row.germination_rate ?? null,
      price: row.price ?? null,
      notes: row.notes ?? '',
      source_url: row.source_url ?? '',
    })));
  } else if (culture.supplier) {
    supplierPayloadRows.push({
      supplier_id: culture.supplier.id ?? null,
      supplier_name_input: culture.supplier.id ? undefined : culture.supplier.name,
      supplier_name: culture.supplier.name,
      supplier_product_url: culture.supplier_product_url ?? '',
      packaging_sizes: [],
      thousand_kernel_weight_g: null,
    });
  }

  const payload: CultureSavePayload = {
    ...culture,
    seed_packages: undefined,
    seed_rate_unit: normalizeSeedRateUnit(culture.seed_rate_unit),
    seed_rate_direct_unit: normalizeSeedRateUnit(culture.seed_rate_direct_unit),
    seed_rate_pre_cultivation_unit: normalizeSeedRateUnit(culture.seed_rate_pre_cultivation_unit),
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
    supplier_data_input: supplierPayloadRows,
    supplier: undefined,
  };

  delete (payload as unknown as Record<string, unknown>).distance_within_row_m;
  delete (payload as unknown as Record<string, unknown>).row_spacing_m;
  delete (payload as unknown as Record<string, unknown>).sowing_depth_m;

  return payload;
}
