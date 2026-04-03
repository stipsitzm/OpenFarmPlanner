import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildCultureFilterParams,
  DEFAULT_CULTURE_FILTERS,
  loadCultureFilters,
  persistCultureFilters,
  type CultureFilters,
} from '../cultures/cultureFilters';

describe('cultureFilters', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds API query params from filter state', () => {
    const filters: CultureFilters = {
      ...DEFAULT_CULTURE_FILTERS,
      search: 'Bohne',
      plantFamily: 'Fabaceae',
      cultivationMethod: 'direct_sowing',
      growthDaysMin: '50',
      growthDaysMax: '120',
      nutrientNeed: 'low',
    };

    expect(buildCultureFilterParams(filters)).toEqual({
      search: 'Bohne',
      plant_family: 'Fabaceae',
      cultivation_method: 'direct_sowing',
      growth_days_min: 50,
      growth_days_max: 120,
      nutrient_need: 'low',
    });
  });

  it('persists and reloads filters from localStorage', () => {
    const filters: CultureFilters = {
      ...DEFAULT_CULTURE_FILTERS,
      search: 'Karotte',
    };

    persistCultureFilters(filters);

    expect(loadCultureFilters()).toEqual({
      ...DEFAULT_CULTURE_FILTERS,
      search: 'Karotte',
    });
  });
});
