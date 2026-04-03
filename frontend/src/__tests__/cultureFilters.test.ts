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
      sowingMonths: [3, 4],
      nutrientNeed: 'low',
      yieldMin: '1.2',
      yieldMax: '3.4',
      requirements: 'trocken',
    };

    expect(buildCultureFilterParams(filters)).toEqual({
      search: 'Bohne',
      plant_family: 'Fabaceae',
      cultivation_method: 'direct_sowing',
      growth_days_min: 50,
      growth_days_max: 120,
      sowing_month: '3,4',
      nutrient_need: 'low',
      yield_min: 1.2,
      yield_max: 3.4,
      requirements: 'trocken',
    });
  });

  it('persists and reloads filters from localStorage', () => {
    const filters: CultureFilters = {
      ...DEFAULT_CULTURE_FILTERS,
      search: 'Karotte',
      sowingMonths: [2, 5, 13],
    };

    persistCultureFilters(filters);

    expect(loadCultureFilters()).toEqual({
      ...DEFAULT_CULTURE_FILTERS,
      search: 'Karotte',
      sowingMonths: [2, 5],
    });
  });
});
