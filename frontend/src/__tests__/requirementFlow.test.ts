import { describe, expect, it } from 'vitest';
import {
  getFirstMissingCultivationPlanRequirement,
  getFirstMissingProjectSetupStep,
  getProjectSetupAction,
} from '../pages/requirementFlow';

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

describe('project setup actions', () => {
  it('returns the first missing setup step including fields before beds', () => {
    expect(getFirstMissingProjectSetupStep({
      hasLocations: true,
      hasFields: false,
      hasBeds: false,
      hasCultures: false,
      hasPlans: false,
    })).toBe('fields');
  });

  it('uses the shared add-field route that opens the fields-beds create flow', () => {
    expect(getProjectSetupAction('fields')).toEqual({
      labelKey: 'common:setupActions.createField',
      to: '/app/fields-beds?create=true',
    });
  });

  it('uses the shared beds step action that opens the fields-beds page', () => {
    expect(getProjectSetupAction('beds')).toEqual({
      labelKey: 'common:setupActions.openAreas',
      to: '/app/fields-beds',
    });
  });
});
