import { describe, it, expect } from 'vitest';
import { validateCulture } from '../cultures/validation';

const t = (key: string) => key;

describe('validateCulture', () => {
  it('returns required field errors for missing mandatory values', () => {
    const result = validateCulture({}, t);

    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe('form.nameRequired');
    expect(result.errors.growth_duration_days).toBe('form.growthDurationDaysRequired');
    expect(result.errors.harvest_duration_days).toBe('form.harvestDurationDaysRequired');
    expect(result.errors.propagation_duration_days).toBe('form.propagationDurationDaysRequired');
  });

  it('validates seed rate value/unit dependencies and positive amount', () => {
    const missingUnit = validateCulture(
      { name: 'Karotte', growth_duration_days: 10, harvest_duration_days: 5, propagation_duration_days: 2, seed_rate_value: 1 },
      t
    );
    expect(missingUnit.errors.seed_rate_unit).toContain('Einheit gewählt werden');

    const missingValue = validateCulture(
      { name: 'Karotte', growth_duration_days: 10, harvest_duration_days: 5, propagation_duration_days: 2, seed_rate_unit: 'g_per_m2' },
      t
    );
    expect(missingValue.errors.seed_rate_value).toContain('Menge angegeben werden');

    const nonPositive = validateCulture(
      { name: 'Karotte', growth_duration_days: 10, harvest_duration_days: 5, propagation_duration_days: 2, seed_rate_value: 0, seed_rate_unit: 'g_per_m2' },
      t
    );
    expect(nonPositive.errors.seed_rate_value).toBe('Die Menge muss größer als 0 sein.');
  });

  it('accepts direct sowing without propagation duration', () => {
    const result = validateCulture(
      {
        name: 'Radies',
        cultivation_type: 'direct_sowing',
        growth_duration_days: 20,
        harvest_duration_days: 10,
      },
      t
    );

    expect(result.errors.propagation_duration_days).toBeUndefined();
  });

  it('rejects negative numeric values including string inputs', () => {
    const result = validateCulture(
      {
        name: 'Tomate',
        cultivation_type: 'pre_cultivation',
        growth_duration_days: '-1' as never,
        harvest_duration_days: -2,
        propagation_duration_days: '-3' as never,
        expected_yield: '-4' as never,
        distance_within_row_cm: -5,
        row_spacing_cm: '-6' as never,
        sowing_depth_cm: -7,
        sowing_calculation_safety_percent: '-8' as never,
      },
      t
    );

    expect(result.errors.growth_duration_days).toBe('form.growthDurationDaysError');
    expect(result.errors.harvest_duration_days).toBe('form.harvestDurationDaysError');
    expect(result.errors.propagation_duration_days).toBe('form.propagationDurationDaysError');
    expect(result.errors.expected_yield).toBe('form.expected_yieldError');
    expect(result.errors.distance_within_row_cm).toBe('form.distance_within_row_cmError');
    expect(result.errors.row_spacing_cm).toBe('form.row_spacing_cmError');
    expect(result.errors.sowing_depth_cm).toBe('form.sowing_depth_cmError');
    expect(result.errors.sowing_calculation_safety_percent).toBe('form.sowing_calculation_safety_percentError');
  });

  it('validates display color format and harvest method dependency', () => {
    const invalidColor = validateCulture(
      {
        name: 'Salat',
        cultivation_type: 'pre_cultivation',
        growth_duration_days: 15,
        harvest_duration_days: 8,
        propagation_duration_days: 4,
        display_color: '#12ZZ00',
      },
      t
    );
    expect(invalidColor.errors.display_color).toBe('form.displayColorError');

    const requiresMethod = validateCulture(
      {
        name: 'Salat',
        cultivation_type: 'pre_cultivation',
        growth_duration_days: 15,
        harvest_duration_days: 8,
        propagation_duration_days: 4,
        expected_yield: 2,
      },
      t
    );
    expect(requiresMethod.errors.harvest_method).toBe('form.harvestMethodRequired');

    const withMethod = validateCulture(
      {
        name: 'Salat',
        cultivation_type: 'pre_cultivation',
        growth_duration_days: 15,
        harvest_duration_days: 8,
        propagation_duration_days: 4,
        expected_yield: 2,
        harvest_method: 'per_sqm',
        display_color: '#12aa00',
      },
      t
    );
    expect(withMethod.isValid).toBe(true);
    expect(withMethod.errors).toEqual({});
  });

  it('accepts string numeric values when non-negative', () => {
    const result = validateCulture(
      {
        name: 'Fenchel',
        cultivation_type: 'pre_cultivation',
        growth_duration_days: '12' as never,
        harvest_duration_days: '7' as never,
        propagation_duration_days: '3' as never,
      },
      t
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

});
