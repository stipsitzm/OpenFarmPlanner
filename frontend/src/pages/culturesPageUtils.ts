export const SELECTED_CULTURE_STORAGE_KEY = 'selectedCultureId';

export type ImportPreviewResult = {
  index: number;
  status: 'create' | 'update_candidate';
  matched_culture_id?: number;
  diff?: Array<{ field: string; current: unknown; new: unknown }>;
  import_data: Record<string, unknown>;
  error?: string;
};

export type ImportFailedEntry = {
  index: number;
  name?: string;
  variety?: string;
  error: string | Record<string, unknown>;
};

export type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
};

export type EnrichmentWarning = { field?: string; code?: string; message?: string };

export const ENRICHMENT_FIELD_LABEL_MAP: Record<string, string> = {
  growth_duration_days: 'form.growthDurationDays',
  harvest_duration_days: 'form.harvestDurationDays',
  propagation_duration_days: 'form.propagationDurationDays',
  harvest_method: 'form.harvestMethod',
  expected_yield: 'form.expectedYield',
  seed_packages: 'form.seedPackagesLabel',
  distance_within_row_cm: 'form.distanceWithinRowCm',
  row_spacing_cm: 'form.rowSpacingCm',
  sowing_depth_cm: 'form.sowingDepthCm',
  seed_rate_direct_value: 'form.seedRateDirectValue',
  seed_rate_direct_unit: 'form.seedRateDirectUnit',
  seed_rate_transplant_value: 'form.seedRatePreCultivationValue',
  seed_rate_transplant_unit: 'form.seedRatePreCultivationUnit',
  seed_rate_by_cultivation: 'form.seedRateSectionTitle',
  allowed_sowing_methods: 'form.cultivationType',
  thousand_kernel_weight_g: 'form.thousandKernelWeightLabel',
  nutrient_demand: 'form.nutrientDemand',
  cultivation_type: 'form.cultivationType',
  notes: 'form.notes',
  seeding_requirement: 'form.seedRateSectionTitle',
  seeding_requirement_type: 'form.seedRateSectionTitle',
};

export const ENRICHMENT_WARNING_KEY_BY_CODE: Record<string, string> = {
  range_collapsed_to_mean: 'ai.warningMessages.range_collapsed_to_mean',
  missing_supplier_data: 'ai.warningMessages.missing_supplier_data',
  supplier_only_non_supplier_suggestion_dropped: 'ai.warningMessages.supplier_only_non_supplier_suggestion_dropped',
  seed_rate_unit_missing_for_method_value: 'ai.warningMessages.seed_rate_unit_missing_for_method_value',
  seed_rate_unit_converted_from_g_per_are: 'ai.warningMessages.seed_rate_unit_converted_from_g_per_are',
  missing_supplier_evidence: 'ai.warningMessages.missing_supplier_evidence',
  supplier_mismatch_dropped: 'ai.warningMessages.supplier_mismatch_dropped',
  supplier_product_not_found: 'ai.warningMessages.supplier_product_not_found',
};

export const ALLOWED_SEED_RATE_UNITS = ['g_per_m2', 'g_per_lfm', 'seeds/m'];

type Translator = (key: string, options?: Record<string, unknown>) => string;

export const toStartCase = (value: string): string => value
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

export const parseCultureId = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsedId = Number.parseInt(value, 10);
  return Number.isFinite(parsedId) ? parsedId : undefined;
};

export const getStoredCultureId = (): number | undefined => parseCultureId(localStorage.getItem(SELECTED_CULTURE_STORAGE_KEY));

export const buildImportSuccessMessage = (
  createdCount: number,
  updatedCount: number,
  skippedCount: number,
  t: Translator,
): string => {
  const segments: string[] = [];

  if (createdCount > 0) {
    segments.push(t('import.created', { count: createdCount }));
  }
  if (updatedCount > 0) {
    segments.push(t('import.updated', { count: updatedCount }));
  }
  if (skippedCount > 0) {
    segments.push(t('import.skipped', { count: skippedCount }));
  }

  return segments.join(', ');
};

export const mapImportErrors = (
  errors: Array<{ index: number; error: unknown }>,
  importPayload: Record<string, unknown>[],
): ImportFailedEntry[] => errors.map((err) => {
  const originalData = importPayload[err.index];
  return {
    index: err.index,
    name: originalData?.name as string | undefined,
    variety: originalData?.variety as string | undefined,
    error: typeof err.error === 'string' || typeof err.error === 'object' ? err.error as string | Record<string, unknown> : String(err.error),
  };
});
