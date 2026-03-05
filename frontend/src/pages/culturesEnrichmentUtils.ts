import type { EnrichmentResult } from '../api/api';
import type { CultivationType, EnrichmentBatchResult, EnrichmentCostEstimate, EnrichmentUsage } from '../api/types';
import { normalizeSeedRateUnit } from '../cultures/enumNormalization';
import {
  ALLOWED_SEED_RATE_UNITS,
  ENRICHMENT_FIELD_LABEL_MAP,
  ENRICHMENT_WARNING_KEY_BY_CODE,
  toStartCase,
  type EnrichmentWarning,
} from './culturesPageUtils';

type Translator = (key: string, options?: Record<string, unknown>) => string;

const formatUsd = (value: number): string => {
  const decimals = value < 1 ? 3 : 2;
  return `$${value.toFixed(decimals)}`;
};

const withVat20 = (netValue: number): number => netValue * 1.2;

const estimateGrossCost = (costEstimate: EnrichmentCostEstimate): number => {
  const breakdown = costEstimate.breakdown;
  const subtotal = typeof breakdown.subtotal === 'number'
    ? breakdown.subtotal
    : (breakdown.input + breakdown.cached_input + breakdown.output + breakdown.web_search_calls);

  if (typeof breakdown.tax === 'number') {
    return subtotal + breakdown.tax;
  }

  return withVat20(subtotal);
};

export const formatCostMessage = (costEstimate: EnrichmentCostEstimate, usage: EnrichmentUsage): string => (
  `KI-Kosten (Schätzung, inkl. 20% MwSt.): ${formatUsd(estimateGrossCost(costEstimate))}  • Tokens: ${usage.inputTokens.toLocaleString('de-DE')} in / ${usage.outputTokens.toLocaleString('de-DE')} out  • Web-Suche: ${costEstimate.breakdown.web_search_call_count} Calls`
);

export const formatBatchCostMessage = (result: EnrichmentBatchResult): string => (
  `Batch KI-Kosten (Schätzung, inkl. 20% MwSt.): ${formatUsd(estimateGrossCost(result.costEstimate))} (${result.succeeded} Kulturen)`
);

export const getDialogCostInfo = (result: EnrichmentResult | null): string | null => {
  if (!result?.costEstimate || !result?.usage) {
    return null;
  }
  return formatCostMessage(result.costEstimate, result.usage);
};

export const getEnrichmentFieldLabel = (field: string, t: Translator): string => {
  const translationKey = ENRICHMENT_FIELD_LABEL_MAP[field];
  if (!translationKey) {
    return toStartCase(field);
  }
  const translated = t(translationKey);
  return translated === translationKey ? toStartCase(field) : translated;
};

const normalizeSuggestedSeedPackages = (value: unknown): Array<{
  size_value: number;
  size_unit: 'g';
  evidence_text?: string;
}> => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const raw = item as Record<string, unknown>;
      const sizeValue = Number(raw.size_value);
      const sizeUnit: 'g' | null = raw.size_unit === 'g'
        ? raw.size_unit
        : null;

      if (!Number.isFinite(sizeValue) || sizeValue <= 0 || !sizeUnit) {
        return null;
      }

      const key = `${sizeUnit}:${sizeValue}`;
      if (seen.has(key)) {
        return null;
      }
      seen.add(key);

      return {
        size_value: sizeValue,
        size_unit: sizeUnit,
        evidence_text: typeof raw.evidence_text === 'string' ? raw.evidence_text : undefined,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
};

export const sanitizeSeedRateByCultivationForMethods = (
  value: unknown,
  methods: CultivationType[],
): Record<string, { value: number; unit: string }> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const allowedMethods = new Set(methods);
  const entries = Object.entries(value as Record<string, { value?: unknown; unit?: unknown }>)
    .filter((entry): entry is [CultivationType, { value?: unknown; unit?: unknown }] => entry[0] === 'pre_cultivation' || entry[0] === 'direct_sowing')
    .filter(([method]) => allowedMethods.has(method));
  if (!entries.length) {
    return null;
  }

  return entries.reduce<Record<string, { value: number; unit: string }>>((acc, [method, rate]) => {
    const parsedValue = Number(rate?.value);
    const unit = normalizeSeedRateUnit(rate?.unit);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0 || !unit || !ALLOWED_SEED_RATE_UNITS.includes(unit)) {
      return acc;
    }
    acc[method] = { value: parsedValue, unit };
    return acc;
  }, {});
};

export const formatSuggestionValue = (field: string, value: unknown, t: Translator): string => {
  if (field === 'seed_packages') {
    const packages = normalizeSuggestedSeedPackages(value);
    if (!packages.length) {
      return t('ai.noSuggestions');
    }
    return packages
      .map((pkg) => `${pkg.size_value} ${pkg.size_unit}`)
      .join(', ');
  }

  if (field === 'seed_rate_by_cultivation' && value && typeof value === 'object') {
    const byMethod = value as Record<string, { value?: unknown; unit?: unknown }>;
    const chunks: string[] = [];
    const direct = byMethod.direct_sowing;
    if (direct && typeof direct === 'object') {
      chunks.push(`Direktsaat: ${String(direct.value ?? '')} ${String(direct.unit ?? '')}`.trim());
    }
    const pre = byMethod.pre_cultivation;
    if (pre && typeof pre === 'object') {
      chunks.push(`Pflanzung: ${String(pre.value ?? '')} ${String(pre.unit ?? '')}`.trim());
    }
    if (chunks.length) {
      return chunks.join(' | ');
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(', ');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value ?? '');
};

export const formatEnrichmentWarning = (warning: EnrichmentWarning, t: Translator): string => {
  const fieldLabel = warning.field ? getEnrichmentFieldLabel(warning.field, t) : t('ai.field');

  const translationKey = warning.code ? ENRICHMENT_WARNING_KEY_BY_CODE[warning.code] : undefined;
  if (translationKey) {
    const translated = t(translationKey, { field: fieldLabel });
    if (translated !== translationKey) {
      return translated;
    }
  }

  return warning.message || t('ai.runError');
};
