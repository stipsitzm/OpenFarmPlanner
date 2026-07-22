export type SpreadsheetColumnDef = {
  header: string;
  key: string;
  aliases: string[];
  type: 'string' | 'number' | 'boolean';
  enumExport?: Record<string, string>;
  enumImport?: Record<string, string>;
};

export const NUTRIENT_DEMAND_EXPORT: Record<string, string> = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
};

export const NUTRIENT_DEMAND_IMPORT: Record<string, string> = {
  niedrig: 'low',
  mittel: 'medium',
  hoch: 'high',
  low: 'low',
  medium: 'medium',
  high: 'high',
};

export const CULTIVATION_TYPE_EXPORT: Record<string, string> = {
  direct_sowing: 'Direktsaat',
  pre_cultivation: 'Pflanzung',
};

export const CULTIVATION_TYPE_IMPORT: Record<string, string> = {
  direktsaat: 'direct_sowing',
  direktsaht: 'direct_sowing',
  pflanzung: 'pre_cultivation',
  direct_sowing: 'direct_sowing',
  pre_cultivation: 'pre_cultivation',
};

export const YIELD_UNIT_EXPORT: Record<string, string> = {
  per_plant: 'Pro Pflanze',
  per_sqm: 'Pro m²',
};

export const YIELD_UNIT_IMPORT: Record<string, string> = {
  'pro pflanze': 'per_plant',
  'je pflanze': 'per_plant',
  'pro m²': 'per_sqm',
  'pro qm': 'per_sqm',
  per_plant: 'per_plant',
  per_sqm: 'per_sqm',
};

export const SEED_RATE_UNIT_EXPORT: Record<string, string> = {
  g_per_m2: 'g/m²',
  g_per_lfm: 'g/lfm',
  seeds_per_m2: 'Körner/m²',
  seeds_per_lfm: 'Körner/lfm',
  seeds_per_plant: 'Körner/Pflanze',
};

export const SEED_RATE_UNIT_IMPORT: Record<string, string> = {
  'g/m²': 'g_per_m2',
  'g/qm': 'g_per_m2',
  'g/lfm': 'g_per_lfm',
  'körner/m²': 'seeds_per_m2',
  'körner/qm': 'seeds_per_m2',
  'körner/lfm': 'seeds_per_lfm',
  'körner/pflanze': 'seeds_per_plant',
  g_per_m2: 'g_per_m2',
  g_per_lfm: 'g_per_lfm',
  seeds_per_m2: 'seeds_per_m2',
  seeds_per_lfm: 'seeds_per_lfm',
  seeds_per_plant: 'seeds_per_plant',
};

export const CULTURE_COLUMNS: SpreadsheetColumnDef[] = [
  {
    key: 'name',
    header: 'Name',
    aliases: ['kulturname', 'kultur', 'bezeichnung'],
    type: 'string',
  },
  {
    key: 'variety',
    header: 'Sorte',
    aliases: ['sortenname', 'varietät', 'cultivar'],
    type: 'string',
  },
  {
    key: 'supplier_name',
    header: 'Saatgutlieferant',
    aliases: ['lieferant', 'seed_supplier', 'hersteller', 'lieferanten'],
    type: 'string',
  },
  {
    key: 'crop_family',
    header: 'Pflanzenfamilie',
    aliases: ['familie', 'pflanzenart', 'pfanzenfamilie'],
    type: 'string',
  },
  {
    key: 'nutrient_demand',
    header: 'Nährstoffbedarf',
    aliases: ['nährstoff', 'düngebedarf', 'nutrient_demand'],
    type: 'string',
    enumExport: NUTRIENT_DEMAND_EXPORT,
    enumImport: NUTRIENT_DEMAND_IMPORT,
  },
  {
    key: 'cultivation_type',
    header: 'Anbauart',
    aliases: ['anbaumethode', 'saatmethode', 'cultivation_type'],
    type: 'string',
    enumExport: CULTIVATION_TYPE_EXPORT,
    enumImport: CULTIVATION_TYPE_IMPORT,
  },
  {
    key: 'growth_duration_days',
    header: 'Wachstumszeit (Tage)',
    aliases: ['wachstumszeit', 'wachstumsdauer', 'wachstumstage', 'tage bis ernte', 'growth_duration_days'],
    type: 'number',
  },
  {
    key: 'harvest_duration_days',
    header: 'Erntezeit (Tage)',
    aliases: ['erntezeit', 'erntezeitraum', 'erntedauer', 'erntedauer tage', 'harvest_duration_days'],
    type: 'number',
  },
  {
    key: 'propagation_duration_days',
    header: 'Anzuchtdauer (Tage)',
    aliases: ['anzuchtdauer', 'anzuchttage', 'propagation_duration_days'],
    type: 'number',
  },
  {
    key: 'harvest_method',
    header: 'Ertragseinheit',
    aliases: ['ertragseinheit', 'ernte methode', 'ernteart', 'harvest_method'],
    type: 'string',
    enumExport: YIELD_UNIT_EXPORT,
    enumImport: YIELD_UNIT_IMPORT,
  },
  {
    key: 'expected_yield',
    header: 'Erwarteter Ertrag (kg/m²)',
    aliases: ['ertrag', 'erwarteter ertrag', 'expected_yield'],
    type: 'number',
  },
  {
    key: 'distance_within_row_cm',
    header: 'Abstand in Reihe (cm)',
    aliases: ['pflanzenabstand', 'abstand in der reihe', 'abstand reihe', 'distance_within_row_cm'],
    type: 'number',
  },
  {
    key: 'row_spacing_cm',
    header: 'Reihenabstand (cm)',
    aliases: ['zeilenabstand', 'reihenzwischenabstand', 'row_spacing_cm'],
    type: 'number',
  },
  {
    key: 'sowing_depth_cm',
    header: 'Saattiefe (cm)',
    aliases: ['tiefe', 'aussaattiefe', 'sowing_depth_cm'],
    type: 'number',
  },
  {
    key: 'thousand_kernel_weight_g',
    header: '1000-Korn-Gewicht (g)',
    aliases: ['tkg', 'tausendkorngewicht', '1000-korn', 'thousand_kernel_weight_g'],
    type: 'number',
  },
  {
    key: 'sowing_calculation_safety_percent',
    header: 'Sicherheitszuschlag (%)',
    aliases: ['sicherheitsaufschlag', 'sicherheitsmarge', 'sowing_calculation_safety_percent'],
    type: 'number',
  },
  {
    key: 'seed_rate_direct_value',
    header: 'Direktsaat Menge',
    aliases: ['direktsaat menge', 'direktsaat saatgut', 'seed_rate_direct_value'],
    type: 'number',
  },
  {
    key: 'seed_rate_direct_unit',
    header: 'Direktsaat Einheit',
    aliases: ['direktsaat einheit', 'seed_rate_direct_unit'],
    type: 'string',
    enumExport: SEED_RATE_UNIT_EXPORT,
    enumImport: SEED_RATE_UNIT_IMPORT,
  },
  {
    key: 'seed_rate_pre_cultivation_value',
    header: 'Pflanzung Menge',
    aliases: ['pflanzung menge', 'pflanzung saatgut', 'seed_rate_pre_cultivation_value'],
    type: 'number',
  },
  {
    key: 'seed_rate_pre_cultivation_unit',
    header: 'Pflanzung Einheit',
    aliases: ['pflanzung einheit', 'seed_rate_pre_cultivation_unit'],
    type: 'string',
    enumExport: SEED_RATE_UNIT_EXPORT,
    enumImport: SEED_RATE_UNIT_IMPORT,
  },
  {
    key: 'notes',
    header: 'Notizen',
    aliases: ['anmerkungen', 'kommentar', 'notiz', 'hinweise'],
    type: 'string',
  },
];

export const normalizeHeaderForLookup = (header: string): string =>
  header.trim().toLowerCase().replace(/\s+/g, ' ');

export const buildHeaderToKeyMap = (): Map<string, string> => {
  const map = new Map<string, string>();
  for (const col of CULTURE_COLUMNS) {
    map.set(normalizeHeaderForLookup(col.header), col.key);
    for (const alias of col.aliases) {
      map.set(normalizeHeaderForLookup(alias), col.key);
    }
  }
  return map;
};
