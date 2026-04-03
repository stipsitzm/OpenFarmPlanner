export type NutrientNeed = '' | 'low' | 'medium' | 'high';
export type CultivationMethodFilter = '' | 'direct_sowing' | 'pre_cultivation' | 'both';

export interface CultureFilters {
  search: string;
  plantFamily: string;
  cultivationMethod: CultivationMethodFilter;
  growthDaysMin: string;
  growthDaysMax: string;
  nutrientNeed: NutrientNeed;
}

export const DEFAULT_CULTURE_FILTERS: CultureFilters = {
  search: '',
  plantFamily: '',
  cultivationMethod: '',
  growthDaysMin: '',
  growthDaysMax: '',
  nutrientNeed: '',
};

const CULTURE_FILTERS_STORAGE_KEY = 'ofp.cultures.filters.v1';

const toNumber = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function buildCultureFilterParams(filters: CultureFilters): Record<string, string | number> {
  const params: Record<string, string | number> = {};

  if (filters.search.trim()) {
    params.search = filters.search.trim();
  }
  if (filters.plantFamily.trim()) {
    params.plant_family = filters.plantFamily.trim();
  }
  if (filters.cultivationMethod) {
    params.cultivation_method = filters.cultivationMethod;
  }

  const growthDaysMin = toNumber(filters.growthDaysMin);
  if (growthDaysMin !== null) {
    params.growth_days_min = growthDaysMin;
  }

  const growthDaysMax = toNumber(filters.growthDaysMax);
  if (growthDaysMax !== null) {
    params.growth_days_max = growthDaysMax;
  }

  if (filters.nutrientNeed) {
    params.nutrient_need = filters.nutrientNeed;
  }

  return params;
}

export function loadCultureFilters(): CultureFilters {
  if (typeof window === 'undefined') {
    return DEFAULT_CULTURE_FILTERS;
  }

  const raw = window.localStorage.getItem(CULTURE_FILTERS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_CULTURE_FILTERS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CultureFilters>;
    return {
      ...DEFAULT_CULTURE_FILTERS,
      ...parsed,
    };
  } catch {
    return DEFAULT_CULTURE_FILTERS;
  }
}

export function persistCultureFilters(filters: CultureFilters): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(CULTURE_FILTERS_STORAGE_KEY, JSON.stringify(filters));
}
