import type { Culture } from '../api/types';

const seedRateUnitMap: Record<string, Culture['seed_rate_unit']> = {
  g_per_m2: 'g_per_m2',
  'g/m²': 'g_per_m2',
  'g/m2': 'g_per_m2',
  'g per m²': 'g_per_m2',
  'g per m2': 'g_per_m2',
  'gramm pro quadratmeter': 'g_per_m2',
  'gramm pro m²': 'g_per_m2',
  'gramm pro m2': 'g_per_m2',
  'gramm je quadratmeter': 'g_per_m2',
  'gramm pro 100 quadratmeter': 'g_per_m2',
  'g pro 100 m²': 'g_per_m2',
  'g pro 100 m2': 'g_per_m2',
  'g per plant': 'seeds_per_plant',
  'seeds/m': 'seeds/m',
  'seeds per meter': 'seeds/m',
  'seeds per metre': 'seeds/m',
  'korn / lfm': 'seeds/m',
  seeds_per_plant: 'seeds_per_plant',
  pcs_per_plant: 'seeds_per_plant',
  'seeds per plant': 'seeds_per_plant',
  'korn / pflanze': 'seeds_per_plant',
};

export function normalizeSeedRateUnit(value: unknown): Culture['seed_rate_unit'] {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  return seedRateUnitMap[normalized] ?? null;
}

export function normalizeHarvestMethod(value: unknown): Culture['harvest_method'] {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim().toLowerCase();
  const map: Record<string, Culture['harvest_method']> = {
    per_plant: 'per_plant',
    'per plant': 'per_plant',
    'pro pflanze': 'per_plant',
    per_sqm: 'per_sqm',
    'per sqm': 'per_sqm',
    'per m2': 'per_sqm',
    'pro m²': 'per_sqm',
  };
  return map[normalized] ?? '';
}

export function normalizeNutrientDemand(value: unknown): Culture['nutrient_demand'] {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim().toLowerCase();
  const map: Record<string, Culture['nutrient_demand']> = {
    low: 'low',
    niedrig: 'low',
    medium: 'medium',
    mittel: 'medium',
    high: 'high',
    hoch: 'high',
  };
  return map[normalized] ?? '';
}

export function normalizeCultivationType(value: unknown): Culture['cultivation_type'] {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim().toLowerCase();
  const map: Record<string, Culture['cultivation_type']> = {
    pre_cultivation: 'pre_cultivation',
    'pre cultivation': 'pre_cultivation',
    anzucht: 'pre_cultivation',
    direct_sowing: 'direct_sowing',
    'direct sowing': 'direct_sowing',
    direktsaat: 'direct_sowing',
  };
  return map[normalized] ?? '';
}

export function normalizeSeedingRequirementType(value: unknown): Culture['seeding_requirement_type'] {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim().toLowerCase();
  const map: Record<string, Culture['seeding_requirement_type']> = {
    per_sqm: 'per_sqm',
    'per sqm': 'per_sqm',
    'per m2': 'per_sqm',
    per_plant: 'per_plant',
    'per plant': 'per_plant',
    'pro pflanze': 'per_plant',
  };
  return map[normalized] ?? '';
}
