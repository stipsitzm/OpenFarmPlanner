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

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

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


  if (draft.supplier_product_url) {
    const allowedDomain = draft.supplier?.allowed_domains?.[0];
    try {
      const host = new URL(draft.supplier_product_url).hostname.toLowerCase().replace(/^www\./, '');
      if (allowedDomain) {
        const normalized = allowedDomain.toLowerCase().replace(/^www\./, '');
        if (!(host === normalized || host.endsWith(`.${normalized}`))) {
          errors.supplier_product_url = `Muss eine URL auf der Domain ${normalized} sein.`;
        }
      }
    } catch {
      errors.supplier_product_url = 'Ungültige URL';
    }
  }

  // Optional numeric fields with explicit error keys
  if (draft.growth_duration_days !== undefined && draft.growth_duration_days !== null && (typeof draft.growth_duration_days !== 'string' || draft.growth_duration_days !== '')) {
    const numValue = toNumber(draft.growth_duration_days);
    if (numValue !== null && numValue < 0) {
      errors.growth_duration_days = t('form.growthDurationDaysError');
    }
  }
  if (draft.harvest_duration_days !== undefined && draft.harvest_duration_days !== null && (typeof draft.harvest_duration_days !== 'string' || draft.harvest_duration_days !== '')) {
    const numValue = toNumber(draft.harvest_duration_days);
    if (numValue !== null && numValue < 0) {
      errors.harvest_duration_days = t('form.harvestDurationDaysError');
    }
  }
  if (draft.propagation_duration_days !== undefined && draft.propagation_duration_days !== null && (typeof draft.propagation_duration_days !== 'string' || draft.propagation_duration_days !== '')) {
    const numValue = toNumber(draft.propagation_duration_days);
    if (numValue !== null && numValue < 0) {
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
      const numValue = toNumber(value);
      if (numValue !== null && numValue < 0) {
        errors[field] = t(`form.${field}Error`, { defaultValue: t('form.growthDurationDaysError') });
      }
    }
  });

  if (draft.seed_packages && Array.isArray(draft.seed_packages)) {
    const seen = new Set<string>();
    draft.seed_packages.forEach((pkg, index) => {
      const sizeValue = toNumber(pkg?.size_value);
      if (sizeValue === null || sizeValue <= 0) {
        errors[`seed_packages.${index}.size_value`] = 'Packgröße muss > 0 sein';
      } else if (Math.round(sizeValue * 10) !== sizeValue * 10) {
        errors[`seed_packages.${index}.size_value`] = 'Packgröße darf maximal eine Nachkommastelle haben';
      }
      const key = `${sizeValue}`;
      if (sizeValue !== null) {
        if (seen.has(key)) {
          errors.seed_packages = 'Doppelte Packungsgrößen sind nicht erlaubt';
        }
        seen.add(key);
      }
    });
  }

  // Display color validation
  if (draft.display_color && !/^#[0-9A-Fa-f]{6}$/.test(draft.display_color)) {
    errors.display_color = t('form.displayColorError');
  }

  // If expected_yield is set, harvest_method must also be selected
  if (
    draft.expected_yield !== undefined &&
    draft.expected_yield !== null &&
    !draft.harvest_method
  ) {
    errors.harvest_method = t('form.harvestMethodRequired');
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
