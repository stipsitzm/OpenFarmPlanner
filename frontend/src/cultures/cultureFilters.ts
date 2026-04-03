export type NutrientNeed = '' | 'low' | 'medium' | 'high';
export type CultivationMethodFilter = '' | 'direct_sowing' | 'pre_cultivation' | 'both';

export interface CultureFilters {
  search: string;
  plantFamily: string;
  cultivationMethod: CultivationMethodFilter;
  growthDaysMin: string;
  growthDaysMax: string;
  sowingMonths: number[];
  nutrientNeed: NutrientNeed;
  yieldMin: string;
  yieldMax: string;
  requirements: string;
}

export const DEFAULT_CULTURE_FILTERS: CultureFilters = {
  search: '',
  plantFamily: '',
  cultivationMethod: '',
  growthDaysMin: '',
  growthDaysMax: '',
  sowingMonths: [],
  nutrientNeed: '',
  yieldMin: '',
  yieldMax: '',
  requirements: '',
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

  if (filters.sowingMonths.length > 0) {
    params.sowing_month = filters.sowingMonths.join(',');
  }

  if (filters.nutrientNeed) {
    params.nutrient_need = filters.nutrientNeed;
  }

  const yieldMin = toNumber(filters.yieldMin);
  if (yieldMin !== null) {
    params.yield_min = yieldMin;
  }

  const yieldMax = toNumber(filters.yieldMax);
  if (yieldMax !== null) {
    params.yield_max = yieldMax;
  }

  if (filters.requirements.trim()) {
    params.requirements = filters.requirements.trim();
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
      sowingMonths: Array.isArray(parsed.sowingMonths)
        ? parsed.sowingMonths.filter((month): month is number => Number.isInteger(month) && month >= 1 && month <= 12)
        : [],
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
