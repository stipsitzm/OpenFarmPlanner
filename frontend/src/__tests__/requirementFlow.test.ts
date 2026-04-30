import { describe, expect, it } from 'vitest';
import { getFirstMissingCultivationPlanRequirement } from '../pages/requirementFlow';

describe('getFirstMissingCultivationPlanRequirement', () => {
  it('returns beds when beds are missing but location and field exist', () => {
    expect(getFirstMissingCultivationPlanRequirement({
      hasLocations: true,
      hasFields: true,
      hasBeds: false,
      hasCultures: true,
    })).toBe('beds');
  });

  it('returns null when all prerequisites are fulfilled', () => {
    expect(getFirstMissingCultivationPlanRequirement({
      hasLocations: true,
      hasFields: true,
      hasBeds: true,
      hasCultures: true,
    })).toBeNull();
  });
});
