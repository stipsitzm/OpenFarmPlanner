import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { cultureAPI, type Culture, type EnrichmentResult } from '../api/api';
import type { CultivationType } from '../api/types';
import { useTranslation } from '../i18n';
import { extractApiErrorMessage, isApiRequestCanceled } from '../api/errors';
import {
  normalizeCultivationType,
  normalizeHarvestMethod,
  normalizeNutrientDemand,
  normalizeSeedingRequirementType,
  normalizeSeedRateUnit,
  normalizeSuggestedSeedPackages,
} from '../cultures/enumNormalization';
import {
  formatBatchCostMessage,
  formatCostMessage,
  getDialogCostInfo,
  sanitizeSeedRateByCultivationForMethods,
} from './culturesEnrichmentUtils';
import { canRunEnrichmentForCulture, cultureHasMissingEnrichmentFields } from './culturesAiUtils';
import { useEnrichmentLoadingProgress } from './useEnrichmentLoadingProgress';

interface UseEnrichmentFeatureConfig {
  selectedCulture: Culture | undefined;
  cultures: Culture[];
  onRefreshCultures: () => Promise<void>;
  onCloseAiMenu: () => void;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info') => void;
}

export function useEnrichmentFeature({
  selectedCulture,
  cultures,
  onRefreshCultures,
  onCloseAiMenu,
  showSnackbar,
}: UseEnrichmentFeatureConfig) {
  const { t } = useTranslation(['cultures', 'common']);

  const [enrichmentDialogOpen, setEnrichmentDialogOpen] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);
  const [selectedSuggestionFields, setSelectedSuggestionFields] = useState<string[]>([]);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentCostBanner, setEnrichmentCostBanner] = useState<string | null>(null);
  const [enrichAllConfirmOpen, setEnrichAllConfirmOpen] = useState(false);
  const enrichmentLoadingRef = useRef(false);
  const enrichmentAbortControllerRef = useRef<AbortController | null>(null);

  const {
    activeStepIndex: enrichmentActiveStepIndex,
    elapsedSeconds: enrichmentElapsedSeconds,
    progressPercent: enrichmentProgressPercent,
    steps: enrichmentLoadingSteps,
  } = useEnrichmentLoadingProgress(enrichmentLoading);

  useEffect(() => {
    enrichmentLoadingRef.current = enrichmentLoading;
  }, [enrichmentLoading]);

  const enrichableCultureIds = useMemo(
    () => cultures
      .filter((culture) => culture.id && canRunEnrichmentForCulture(culture) && cultureHasMissingEnrichmentFields(culture))
      .map((culture) => culture.id as number),
    [cultures],
  );

  const selectedCultureNeedsCompletion = useMemo(
    () => (selectedCulture ? cultureHasMissingEnrichmentFields(selectedCulture) : false),
    [selectedCulture],
  );

  const dialogCostInfo = getDialogCostInfo(enrichmentResult);

  const openEnrichmentDialog = (result: EnrichmentResult) => {
    setEnrichmentResult(result);
    setSelectedSuggestionFields(Object.keys(result.suggested_fields || {}));
    setEnrichmentDialogOpen(true);
  };

  const handleCancelEnrichment = useCallback(() => {
    if (!enrichmentLoadingRef.current) {
      return;
    }
    enrichmentAbortControllerRef.current?.abort();
    enrichmentAbortControllerRef.current = null;
    setEnrichmentLoading(false);
    showSnackbar(t('ai.cancelled'), 'success');
  }, [showSnackbar, t]);

  useEffect(() => {
    const onEscapeCancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (!enrichmentLoadingRef.current) {
        return;
      }
      event.preventDefault();
      handleCancelEnrichment();
    };

    window.addEventListener('keydown', onEscapeCancel, { capture: true });
    return () => window.removeEventListener('keydown', onEscapeCancel, { capture: true });
  }, [handleCancelEnrichment]);

  const handleEnrichCurrent = async (mode: 'complete' | 'reresearch') => {
    if (!selectedCulture?.id) return;
    const controller = new AbortController();
    enrichmentAbortControllerRef.current = controller;
    setEnrichmentLoading(true);
    onCloseAiMenu();
    try {
      const response = await cultureAPI.enrich(selectedCulture.id, mode, controller.signal);
      openEnrichmentDialog(response.data);
      const costMessage = formatCostMessage(response.data.costEstimate, response.data.usage);
      setEnrichmentCostBanner(costMessage);
      showSnackbar(costMessage, 'info');
    } catch (error) {
      if (isApiRequestCanceled(error)) {
        return;
      }
      console.error('Error enriching culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('ai.runError')), 'error');
    } finally {
      if (enrichmentAbortControllerRef.current === controller) {
        enrichmentAbortControllerRef.current = null;
      }
      setEnrichmentLoading(false);
    }
  };

  const handleEnrichAll = async () => {
    if (enrichableCultureIds.length === 0) {
      setEnrichAllConfirmOpen(false);
      showSnackbar(t('ai.batchNoMissing'), 'success');
      return;
    }

    const controller = new AbortController();
    enrichmentAbortControllerRef.current = controller;
    setEnrichmentLoading(true);
    setEnrichAllConfirmOpen(false);
    onCloseAiMenu();
    try {
      const response = await cultureAPI.enrichBatch({ culture_ids: enrichableCultureIds, limit: enrichableCultureIds.length }, controller.signal);
      showSnackbar(t('ai.batchDone', { ok: response.data.succeeded, failed: response.data.failed }), 'success');
      const costMessage = formatBatchCostMessage(response.data);
      setEnrichmentCostBanner(costMessage);
      showSnackbar(costMessage, 'info');
      const first = response.data.items.find((item) => item.status === 'completed' && item.result)?.result;
      if (first) {
        openEnrichmentDialog(first);
      }
    } catch (error) {
      if (isApiRequestCanceled(error)) {
        return;
      }
      console.error('Error enriching all cultures:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('ai.runError')), 'error');
    } finally {
      if (enrichmentAbortControllerRef.current === controller) {
        enrichmentAbortControllerRef.current = null;
      }
      setEnrichmentLoading(false);
    }
  };

  const toggleSuggestionField = (field: string) => {
    setSelectedSuggestionFields((prev) =>
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field],
    );
  };

  const handleApplySuggestions = async () => {
    if (!enrichmentResult?.culture_id || !selectedSuggestionFields.length) {
      setEnrichmentDialogOpen(false);
      return;
    }

    const targetCulture = cultures.find((item) => item.id === enrichmentResult.culture_id);
    if (!targetCulture) return;

    const patch: Record<string, unknown> = {};
    selectedSuggestionFields.forEach((field) => {
      const suggestionValue = enrichmentResult.suggested_fields[field]?.value;
      if (field === 'seed_packages') {
        patch[field] = normalizeSuggestedSeedPackages(suggestionValue);
        return;
      }
      if (field === 'seed_rate_direct_unit' || field === 'seed_rate_transplant_unit') {
        patch[field] = normalizeSeedRateUnit(suggestionValue);
        return;
      }
      if (field === 'allowed_sowing_methods') {
        const methods = Array.isArray(suggestionValue)
          ? suggestionValue.map((item) => normalizeCultivationType(item)).filter(Boolean)
          : [];
        patch.cultivation_types = methods;
        if (methods.length > 0) {
          patch.cultivation_type = methods[0];
        }
        return;
      }
      if (field === 'seed_rate_by_cultivation' && suggestionValue && typeof suggestionValue === 'object') {
        const rawByCultivation = suggestionValue as Record<string, { value?: unknown; unit?: unknown }>;
        const sanitizedByCultivation: Record<string, { value: number; unit: string }> = {};
        const directValue = Number(rawByCultivation.direct_sowing?.value);
        const directUnit = normalizeSeedRateUnit(rawByCultivation.direct_sowing?.unit);
        if (Number.isFinite(directValue) && directValue > 0 && directUnit && ['g_per_m2', 'g_per_lfm', 'seeds_per_m2', 'seeds_per_lfm', 'seeds_per_plant'].includes(directUnit)) {
          sanitizedByCultivation.direct_sowing = { value: directValue, unit: directUnit };
        }
        const preValue = Number(rawByCultivation.pre_cultivation?.value);
        const preUnit = normalizeSeedRateUnit(rawByCultivation.pre_cultivation?.unit);
        if (Number.isFinite(preValue) && preValue > 0 && preUnit && ['g_per_m2', 'g_per_lfm', 'seeds_per_m2', 'seeds_per_lfm', 'seeds_per_plant'].includes(preUnit)) {
          sanitizedByCultivation.pre_cultivation = { value: preValue, unit: preUnit };
        }
        if (Object.keys(sanitizedByCultivation).length > 0) {
          patch.seed_rate_by_cultivation = sanitizedByCultivation;
        }
        return;
      }
      if (field === 'seed_rate_direct_value' || field === 'seed_rate_direct_unit' || field === 'seed_rate_transplant_value' || field === 'seed_rate_transplant_unit') {
        const directValue = field === 'seed_rate_direct_value'
          ? Number(suggestionValue)
          : Number(enrichmentResult.suggested_fields.seed_rate_direct_value?.value);
        const directUnit = field === 'seed_rate_direct_unit'
          ? normalizeSeedRateUnit(suggestionValue)
          : normalizeSeedRateUnit(enrichmentResult.suggested_fields.seed_rate_direct_unit?.value);
        const transplantValue = field === 'seed_rate_transplant_value'
          ? Number(suggestionValue)
          : Number(enrichmentResult.suggested_fields.seed_rate_transplant_value?.value);
        const transplantUnit = field === 'seed_rate_transplant_unit'
          ? normalizeSeedRateUnit(suggestionValue)
          : normalizeSeedRateUnit(enrichmentResult.suggested_fields.seed_rate_transplant_unit?.value);

        const byCultivation: Record<string, { value: number; unit: string }> = {};
        if (Number.isFinite(directValue) && directValue > 0 && directUnit) {
          byCultivation.direct_sowing = { value: directValue, unit: directUnit };
        }
        if (Number.isFinite(transplantValue) && transplantValue > 0 && transplantUnit && ['g_per_m2', 'g_per_lfm', 'seeds_per_m2', 'seeds_per_lfm', 'seeds_per_plant'].includes(transplantUnit)) {
          byCultivation.pre_cultivation = { value: transplantValue, unit: transplantUnit };
        }
        if (Object.keys(byCultivation).length > 0) {
          patch.seed_rate_by_cultivation = byCultivation;
        }
        return;
      }
      if (field === 'harvest_method') {
        patch[field] = normalizeHarvestMethod(suggestionValue);
        return;
      }
      if (field === 'nutrient_demand') {
        patch[field] = normalizeNutrientDemand(suggestionValue);
        return;
      }
      if (field === 'cultivation_type') {
        patch[field] = normalizeCultivationType(suggestionValue);
        patch.cultivation_types = [normalizeCultivationType(suggestionValue)].filter(Boolean);
        return;
      }
      patch[field] = suggestionValue;
    });

    const nextCultivationTypesRaw = Array.isArray(patch.cultivation_types)
      ? patch.cultivation_types
      : (targetCulture.cultivation_types && targetCulture.cultivation_types.length > 0
        ? targetCulture.cultivation_types
        : (targetCulture.cultivation_type ? [normalizeCultivationType(targetCulture.cultivation_type)] : ['pre_cultivation']));
    const nextCultivationTypes = nextCultivationTypesRaw
      .map((method) => normalizeCultivationType(method))
      .filter((method): method is CultivationType => method === 'pre_cultivation' || method === 'direct_sowing');

    if (patch.seed_rate_by_cultivation) {
      const sanitizedByMethod = sanitizeSeedRateByCultivationForMethods(patch.seed_rate_by_cultivation, nextCultivationTypes);
      if (sanitizedByMethod && Object.keys(sanitizedByMethod).length > 0) {
        patch.seed_rate_by_cultivation = sanitizedByMethod;
      } else {
        delete patch.seed_rate_by_cultivation;
      }
    }

    try {
      await cultureAPI.update(targetCulture.id!, {
        ...targetCulture,
        seed_rate_unit: normalizeSeedRateUnit(targetCulture.seed_rate_unit),
        harvest_method: normalizeHarvestMethod(targetCulture.harvest_method),
        nutrient_demand: normalizeNutrientDemand(targetCulture.nutrient_demand),
        cultivation_type: normalizeCultivationType(targetCulture.cultivation_type),
        cultivation_types: (targetCulture.cultivation_types && targetCulture.cultivation_types.length > 0)
          ? targetCulture.cultivation_types
          : (targetCulture.cultivation_type ? [normalizeCultivationType(targetCulture.cultivation_type)] : ['pre_cultivation']),
        seed_rate_by_cultivation: targetCulture.seed_rate_by_cultivation ?? null,
        seeding_requirement_type: normalizeSeedingRequirementType(targetCulture.seeding_requirement_type),
        ...patch,
      } as Culture);
      await onRefreshCultures();
      showSnackbar(t('ai.applySuccess'), 'success');
      setEnrichmentDialogOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error applying enrichment suggestions:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('messages.updateError')), 'error');
    }
  };

  return {
    enrichAllConfirmOpen,
    setEnrichAllConfirmOpen,
    enrichableCultureIds,
    enrichmentLoading,
    enrichmentActiveStepIndex,
    enrichmentElapsedSeconds,
    enrichmentProgressPercent,
    enrichmentLoadingSteps,
    enrichmentDialogOpen,
    setEnrichmentDialogOpen,
    enrichmentResult,
    selectedSuggestionFields,
    dialogCostInfo,
    enrichmentCostBanner,
    selectedCultureNeedsCompletion,
    handleCancelEnrichment,
    handleEnrichCurrent,
    handleEnrichAll,
    toggleSuggestionField,
    handleApplySuggestions,
  };
}
