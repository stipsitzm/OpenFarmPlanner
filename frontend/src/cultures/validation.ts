/**
 * Validation logic for CultureForm.
 *
 * Exports a pure function for validating a draft culture object.
 */
import type { Culture } from '../api/types';
import type { TFunction } from 'i18next';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates a draft culture object for the form.
 *
 * @param draft - Partial culture object (form state)
 * @param t - Translation function
 * @returns ValidationResult with errors keyed by field
 */
export function validateCulture(
  draft: Partial<Culture>,
  t: TFunction
): ValidationResult {
  const errors: Record<string, string> = {};

  // Seed rate validation (custom rule)
  const hasSeedRateValue = draft.seed_rate_value !== null && draft.seed_rate_value !== undefined;
  const hasSeedRateUnit = draft.seed_rate_unit !== null && draft.seed_rate_unit !== undefined;
  if (hasSeedRateValue && !hasSeedRateUnit) {
    errors.seed_rate_unit = t('form.seedRateUnitRequired');
  }
  if (hasSeedRateValue && Number(draft.seed_rate_value) <= 0) {
    errors.seed_rate_value = t('form.seedRateValueRequired');
  }

  // Required fields: name, variety, supplier
  if (!draft.name) {
    errors.name = t('form.nameRequired');
  }
  if (!draft.variety) {
    errors.variety = t('form.varietyRequired');
  }
  if (!draft.supplier) {
    errors.supplier = t('form.supplierRequired');
  }

  // Optional numeric fields with explicit error keys
  if (draft.growth_duration_days !== undefined && draft.growth_duration_days !== null && (typeof draft.growth_duration_days !== 'string' || draft.growth_duration_days !== '')) {
    const numValue = typeof draft.growth_duration_days === 'string' ? parseFloat(draft.growth_duration_days) : Number(draft.growth_duration_days);
    if (numValue < 0) {
      errors.growth_duration_days = t('form.growthDurationDaysError');
    }
  }
  if (draft.harvest_duration_days !== undefined && draft.harvest_duration_days !== null && (typeof draft.harvest_duration_days !== 'string' || draft.harvest_duration_days !== '')) {
    const numValue = typeof draft.harvest_duration_days === 'string' ? parseFloat(draft.harvest_duration_days) : Number(draft.harvest_duration_days);
    if (numValue < 0) {
      errors.harvest_duration_days = t('form.harvestDurationDaysError');
    }
  }
  if (draft.propagation_duration_days !== undefined && draft.propagation_duration_days !== null && (typeof draft.propagation_duration_days !== 'string' || draft.propagation_duration_days !== '')) {
    const numValue = typeof draft.propagation_duration_days === 'string' ? parseFloat(draft.propagation_duration_days) : Number(draft.propagation_duration_days);
    if (numValue < 0) {
      errors.propagation_duration_days = t('form.propagationDurationDaysError');
    }
  }

  // Optional numeric fields validation
  const numericFields = [
    'expected_yield',
    'distance_within_row_cm',
    'row_spacing_cm',
    'sowing_depth_cm',
    'sowing_calculation_safety_percent',
    'thousand_kernel_weight_g',
    'package_size_g',
  ];
  numericFields.forEach(field => {
    const value = draft[field as keyof Culture];
    if (value !== undefined && value !== null && value !== '') {
      const numValue = typeof value === 'string' ? parseFloat(value as string) : (value as number);
      if (numValue < 0) {
        errors[field] = t(`form.${field}Error`, { defaultValue: t('form.growthDurationDaysError') });
      }
    }
  });
  // Display color validation
  if (draft.display_color && !/^#[0-9A-Fa-f]{6}$/.test(draft.display_color)) {
    errors.display_color = t('form.displayColorError');
  }

  // Wenn expected_yield gesetzt ist, muss auch harvest_method gewählt sein
  if (
    draft.expected_yield !== undefined &&
    draft.expected_yield !== null &&
    typeof draft.expected_yield === 'number' &&
    !draft.harvest_method
  ) {
    errors.harvest_method = t('form.harvestMethodRequired');
  }

  if (
    draft.expected_yield !== undefined &&
    draft.expected_yield !== null &&
    typeof draft.expected_yield === 'number' &&
    !draft.expected_yield_unit
  ) {
    errors.expected_yield_unit = t('form.expectedYieldUnitRequired');
  }

  if (
    (draft.expected_yield === undefined || draft.expected_yield === null) &&
    draft.expected_yield_unit
  ) {
    errors.expected_yield = t('form.expectedYieldValueRequired');
  }

  if (
    (draft.seeding_requirement === undefined || draft.seeding_requirement === null) &&
    draft.seeding_requirement_type
  ) {
    errors.seeding_requirement = t('form.seedingRequirementValueRequired');
  }
  if (
    draft.seeding_requirement !== undefined &&
    draft.seeding_requirement !== null &&
    !draft.seeding_requirement_type
  ) {
    errors.seeding_requirement_type = t('form.seedingRequirementTypeRequired');
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
