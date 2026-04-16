import { describe, expect, it } from 'vitest';
import { getAllowedCultivationTypesForCulture } from '../pages/plantingPlansUtils';

describe('getAllowedCultivationTypesForCulture', () => {
  it('returns only allowed values from cultivation_types', () => {
    const options = getAllowedCultivationTypesForCulture({
      cultivation_types: ['direct_sowing'],
    } as never);

    expect(options).toEqual(['direct_sowing']);
  });

  it('falls back to cultivation_type if cultivation_types is missing', () => {
    const options = getAllowedCultivationTypesForCulture({
      cultivation_type: 'pre_cultivation',
    } as never);

    expect(options).toEqual(['pre_cultivation']);
  });

  it('falls back to both options when culture does not define restrictions', () => {
    const options = getAllowedCultivationTypesForCulture(undefined);

    expect(options).toEqual(['direct_sowing', 'pre_cultivation']);
  });
});
