/**
 * Cultures (Kulturen) page component.
 * 
 * Displays crop culture details with searchable dropdown.
 * Includes create and edit functionality for cultures.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from '../i18n';
import { cultureAPI, publicCultureAPI, type Culture, type EnrichmentResult } from '../api/api';
import type {
  CultivationType,
  CultureHistoryEntry,
  PublicCulture,
  PublishPublicCultureDuplicateError,
} from '../api/types';
import { CultureDetail } from '../cultures/CultureDetail';
import { CultureForm } from '../cultures/CultureForm';
import { PublicCultureLibraryDialog } from '../cultures/PublicCultureLibraryDialog';
import {
  normalizeCultivationType,
  normalizeHarvestMethod,
  normalizeNutrientDemand,
  normalizeSeedingRequirementType,
  normalizeSeedRateUnit,
  normalizeSuggestedSeedPackages,
} from '../cultures/enumNormalization';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Tooltip,
  Typography,
  Link,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import PublicIcon from '@mui/icons-material/Public';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import {
  buildAllCulturesExport,
  buildAllCulturesFilename,
  buildSingleCultureExport,
  buildSingleCultureFilename,
  downloadJsonFile,
} from '../cultures/exportUtils';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import { isTypingInEditableElement } from '../hooks/useKeyboardShortcuts';
import { extractApiErrorMessage, isApiRequestCanceled } from '../api/errors';
import {
  buildImportSuccessMessage,
  mapImportErrors,
  type SnackbarState,
} from './culturesPageUtils';
import {
  formatBatchCostMessage,
  formatCostMessage,
  formatEnrichmentWarning,
  formatSuggestionValue,
  getDialogCostInfo,
  getEnrichmentFieldLabel,
  sanitizeSeedRateByCultivationForMethods,
} from './culturesEnrichmentUtils';
import { analyzeCultureImportJson, readFileAsText } from './culturesImportUtils';
import { createCulturesCommandSpecs } from './culturesCommandSpecs';
import { canRunEnrichmentForCulture, cultureHasMissingEnrichmentFields } from './culturesAiUtils';
import { buildCultureSavePayload } from './culturesSaveUtils';
import { getHistoryEntryMeta, getHistoryEntryTarget, getHistoryEntryTitle } from './culturesHistoryUtils';
import { useSelectedCultureSync } from './useSelectedCultureSync';
import { FEATURES } from '../config/features';
import { useAuth } from '../auth/useAuth';
import { dedupePublicCultures } from './publicCultureUtils';
import { useCultureImportState } from './useCultureImportState';
import { useEnrichmentLoadingProgress } from './useEnrichmentLoadingProgress';
import { CulturesImportDialog } from './CulturesImportDialog';
import { EnrichmentLoadingDialog } from './EnrichmentLoadingDialog';

function Cultures(): React.ReactElement {
  const { t } = useTranslation('cultures');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCultureId, updateSelectedCultureId } = useSelectedCultureSync();
  const fallbackHistoryActorLabel = user?.display_label || user?.display_name || user?.email || undefined;

  const [cultures, setCultures] = useState<Culture[]>([]);
  const [isCulturesLoading, setIsCulturesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | undefined>(undefined);
  const [importMenuAnchor, setImportMenuAnchor] = useState<null | HTMLElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const {
    state: importState,
    hasImportableEntries,
    reset: resetImportState,
    setErrorState: setImportErrorState,
    setPreviewReadyState,
    setUploading: setImportUploading,
    setPartialFailure: setImportPartialFailure,
    setSuccessState: setImportSuccessState,
  } = useCultureImportState();
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [confirmUpdates, setConfirmUpdates] = useState(false);
  const [deleteDialogCulture, setDeleteDialogCulture] = useState<Culture | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<CultureHistoryEntry[]>([]);
  const [historyScope, setHistoryScope] = useState<'culture' | 'global' | 'project'>('culture');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aiMenuAnchor, setAiMenuAnchor] = useState<null | HTMLElement>(null);
  const aiEnrichmentEnabled = FEATURES.AI_ENRICHMENT;
  const [enrichmentDialogOpen, setEnrichmentDialogOpen] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);
  const [selectedSuggestionFields, setSelectedSuggestionFields] = useState<string[]>([]);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentCostBanner, setEnrichmentCostBanner] = useState<string | null>(null);
  const [enrichAllConfirmOpen, setEnrichAllConfirmOpen] = useState(false);
  const enrichmentLoadingRef = useRef(false);
  const enrichmentAbortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [publicLibraryOpen, setPublicLibraryOpen] = useState(false);
  const [publicLibraryLoading, setPublicLibraryLoading] = useState(false);
  const [publicLibraryError, setPublicLibraryError] = useState<string | null>(null);
  const [publicCultures, setPublicCultures] = useState<PublicCulture[]>([]);
  const [publicLibraryImportingId, setPublicLibraryImportingId] = useState<number | null>(null);
  const [publishingCultureId, setPublishingCultureId] = useState<number | null>(null);

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);



  useEffect(() => {
    enrichmentLoadingRef.current = enrichmentLoading;
  }, [enrichmentLoading]);

  const {
    activeStepIndex: enrichmentActiveStepIndex,
    elapsedSeconds: enrichmentElapsedSeconds,
    progressPercent: enrichmentProgressPercent,
    steps: enrichmentLoadingSteps,
  } = useEnrichmentLoadingProgress(enrichmentLoading);


  const fetchCultures = useCallback(async () => {
    setIsCulturesLoading(true);
    try {
      const response = await cultureAPI.list();
      setCultures(response.data.results);
    } catch (error) {
      console.error('Error fetching cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    } finally {
      setIsCulturesLoading(false);
    }
  }, [showSnackbar, t]);

  // Fetch cultures on mount
  useEffect(() => {
    // eslint-disable-next-line -- Data fetching on mount is intentional
    fetchCultures();
  }, [fetchCultures]);


  useEffect(() => {
    if (cultures.length === 0) {
      return;
    }

    if (selectedCultureId !== undefined && !cultures.some((culture) => culture.id === selectedCultureId)) {
      updateSelectedCultureId(undefined, 'internal');
    }
  }, [cultures, selectedCultureId, updateSelectedCultureId]);

  const handleCultureSelect = (culture: Culture | null) => {
    updateSelectedCultureId(culture?.id, 'internal');
  };

  const handleAddNew = () => {
    setEditingCulture(undefined);
    setShowForm(true);
  };

  const handleEdit = (culture: Culture) => {
    setEditingCulture(culture);
    setShowForm(true);
  };

  const handleDelete = (culture: Culture) => {
    setDeleteDialogCulture(culture);
  };

  const handleOpenHistory = async () => {
    handleImportMenuClose();
    if (!selectedCulture?.id) {
      return;
    }
    const response = await cultureAPI.history(selectedCulture.id);
    setHistoryItems(response.data);
    setHistoryScope('culture');
    setHistoryOpen(true);
  };

  const handleRestoreVersion = async (historyId: number) => {
    if (historyScope === 'project') {
      await cultureAPI.projectRestore(historyId);
      await fetchCultures();
      setHistoryOpen(false);
      return;
    }

    if (historyScope === 'global') {
      await cultureAPI.globalRestore(historyId);
      await fetchCultures();
      setHistoryOpen(false);
      return;
    }

    if (!selectedCulture?.id) return;
    await cultureAPI.restore(selectedCulture.id, historyId);
    await fetchCultures();
    setHistoryOpen(false);
  };


  const handleDeleteConfirm = async () => {
    if (!deleteDialogCulture?.id) {
      return;
    }

    try {
      await cultureAPI.delete(deleteDialogCulture.id);
      await fetchCultures();
      if (selectedCultureId === deleteDialogCulture.id) {
        updateSelectedCultureId(undefined, 'internal');
      }
      showSnackbar(t('messages.updateSuccess'), 'success');
      setDeleteDialogCulture(null);
    } catch (error) {
      console.error('Error deleting culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('messages.updateError')), 'error');
    }
  };

  const handleSave = async (culture: Culture) => {
    try {
      const savePayload = buildCultureSavePayload(culture);

      let savedCulture: Culture;
      if (editingCulture) {
        const response = await cultureAPI.update(editingCulture.id!, savePayload as Culture);
        savedCulture = response.data;
        showSnackbar(t('messages.updateSuccess'), 'success');
      } else {
        const response = await cultureAPI.create(savePayload as Culture);
        savedCulture = response.data;
        showSnackbar(t('messages.createSuccess'), 'success');
        // Auto-select the newly created culture
        updateSelectedCultureId(savedCulture.id, 'internal');
      }
      await fetchCultures();
      setShowForm(false);
      setEditingCulture(undefined);
    } catch (error) {
      console.error('Error saving culture:', error);
      throw error; // Re-throw to prevent form from closing
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingCulture(undefined);
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleCreatePlantingPlan = () => {
    if (selectedCultureId) {
      navigate(`/app/planting-plans?cultureId=${selectedCultureId}`);
    }
  };

  const handleImportMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setImportMenuAnchor(event.currentTarget);
  };

  const handleImportMenuClose = () => {
    setImportMenuAnchor(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?') {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (isTypingInEditableElement(document.activeElement)) {
        return;
      }
      event.preventDefault();
      setShortcutsOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fetchPublicCultures = useCallback(async (query = '') => {
    try {
      setPublicLibraryLoading(true);
      setPublicLibraryError(null);
      const response = await publicCultureAPI.list(query ? { q: query } : undefined);
      setPublicCultures(dedupePublicCultures(response.data.results));
    } catch (error) {
      console.error('Error fetching public cultures:', error);
      setPublicLibraryError(t('library.loadError'));
    } finally {
      setPublicLibraryLoading(false);
    }
  }, [t]);

  const handleOpenPublicLibrary = async () => {
    handleImportMenuClose();
    setPublicLibraryOpen(true);
    await fetchPublicCultures();
  };

  const handleImportPublicCulture = async (publicCulture: PublicCulture) => {
    try {
      setPublicLibraryImportingId(publicCulture.id);
      const response = await publicCultureAPI.importToProject(publicCulture.id);
      await fetchCultures();
      updateSelectedCultureId(response.data.id, 'internal');
      setPublicLibraryOpen(false);
      showSnackbar(t('library.importSuccess', { name: publicCulture.name }), 'success');
    } catch (error) {
      console.error('Error importing public culture:', error);
      setPublicLibraryError(extractApiErrorMessage(error, t, t('library.importError')));
    } finally {
      setPublicLibraryImportingId(null);
    }
  };

  const handlePublishCurrentCulture = async () => {
    if (!selectedCulture?.id) {
      return;
    }

    try {
      setPublishingCultureId(selectedCulture.id);
      const response = await cultureAPI.publishPublic(selectedCulture.id);
      if (response.data.operation === 'updated') {
        showSnackbar(t('library.updateSuccess', { name: selectedCulture.name }), 'success');
      } else {
        showSnackbar(t('library.publishSuccess', { name: selectedCulture.name }), 'success');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        const duplicateError = error.response.data as PublishPublicCultureDuplicateError | undefined;
        const duplicateNames = (duplicateError?.duplicates || [])
          .map((entry) => entry.variety ? `${entry.name} (${entry.variety})` : entry.name)
          .join(', ');
        if (duplicateNames) {
          showSnackbar(t('library.publishDuplicateErrorWithCandidates', { duplicates: duplicateNames }), 'info');
        } else {
          showSnackbar(t('library.publishDuplicateError'), 'info');
        }
        return;
      }
      console.error('Error publishing culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('library.publishError')), 'error');
    } finally {
      setPublishingCultureId(null);
    }
  };

  const handleImportFileTrigger = () => {
    handleImportMenuClose();
    resetImportState();
    fileInputRef.current?.click();
  };

  const handleExportCurrentCulture = () => {
    if (!selectedCulture) {
      return;
    }

    const exportPayload = buildSingleCultureExport(selectedCulture);
    const filename = buildSingleCultureFilename(selectedCulture);
    downloadJsonFile(exportPayload, filename);
    showSnackbar(t('messages.exportSuccess'), 'success');
    handleImportMenuClose();
  };

  const handleExportAllCultures = async () => {
    try {
      const allCultures: Culture[] = [];
      let nextUrl: string | null = '/cultures/';

      while (nextUrl) {
        const response = await cultureAPI.list(nextUrl);
        allCultures.push(...response.data.results);
        nextUrl = response.data.next;
      }

      const exportPayload = buildAllCulturesExport(allCultures);
      const filename = buildAllCulturesFilename();
      downloadJsonFile(exportPayload, filename);
      showSnackbar(t('messages.exportSuccess'), 'success');
    } catch (error) {
      console.error('Error exporting cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    } finally {
      handleImportMenuClose();
    }
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const jsonString = await readFileAsText(file);
      const importAnalysis = analyzeCultureImportJson(jsonString, t);

      if (importAnalysis.status === 'error') {
        setImportErrorState({
          error: t(importAnalysis.errorKey),
          previewCount: importAnalysis.originalCount,
          validCount: 0,
          invalidEntries: importAnalysis.invalidEntries,
        });
        setImportDialogOpen(true);
        return;
      }

      setImportUploading();
      try {
        const response = await cultureAPI.importPreview(importAnalysis.validEntries);

        setPreviewReadyState({
          previewCount: importAnalysis.originalCount,
          validCount: importAnalysis.validEntries.length,
          invalidEntries: importAnalysis.invalidEntries,
          payload: importAnalysis.validEntries,
          previewResults: response.data.results,
        });
        setImportDialogOpen(true);
      } catch (error) {
        console.error('Error calling preview endpoint:', error);
        setImportErrorState({ error: t('import.errors.network') });
        setImportDialogOpen(true);
      }
    } catch (error) {
      console.error('Error reading JSON file:', error);
      setImportErrorState({ error: t('import.errors.parse') });
      setImportDialogOpen(true);
    }
  };

  const handleImportStart = async () => {
    if (!hasImportableEntries || importState.status === 'uploading') {
      return;
    }

    setImportUploading();

    try {
      const response = await cultureAPI.importApply({
        items: importState.payload,
        confirm_updates: confirmUpdates,
      });

      const { created_count, updated_count, skipped_count, errors } = response.data;
      
      if (errors.length > 0) {
        setImportPartialFailure({
          failedEntries: mapImportErrors(errors, importState.payload),
          error: t('import.errors.someFailures', {
            failed: errors.length,
          }),
        });
        return;
      }

      const successMessage = buildImportSuccessMessage(created_count, updated_count, skipped_count, t);

      setImportSuccessState(successMessage || t('import.success'));
      await fetchCultures();
    } catch (error) {
      console.error('Error importing cultures:', error);
      setImportErrorState({ error: t('import.errors.network') });
    }
  };

  const handleImportDialogClose = () => {
    setImportDialogOpen(false);
  };

  const selectedCulture = cultures.find(c => c.id === selectedCultureId);
  const isUpdatingOwnPublicCulture = Boolean(selectedCulture?.owned_public_culture_id);
  const dialogCostInfo = getDialogCostInfo(enrichmentResult);

  useCommandContextTag('cultures');

  const getCultureLabel = useCallback((culture: Culture): string => {
    return `${culture.name}${culture.variety ? ` – ${culture.variety}` : ''}${culture.seed_supplier ? ` | ${culture.seed_supplier}` : ''}`;
  }, []);

  const goToRelativeCulture = useCallback((direction: 'next' | 'previous') => {
    if (!selectedCultureId || cultures.length === 0) {
      return;
    }

    const currentIndex = cultures.findIndex((culture) => culture.id === selectedCultureId);
    if (currentIndex === -1) {
      return;
    }

    const delta = direction === 'next' ? 1 : -1;
    const nextIndex = (currentIndex + delta + cultures.length) % cultures.length;
    updateSelectedCultureId(cultures[nextIndex]?.id, 'internal');
  }, [cultures, selectedCultureId, updateSelectedCultureId]);

  const enrichmentDisabledReason = 'Für KI-Recherche muss ein Lieferant mit erlaubten Domains konfiguriert sein.';

  const handleAiMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAiMenuAnchor(event.currentTarget);
  };

  const handleAiMenuClose = () => {
    setAiMenuAnchor(null);
  };


  const openEnrichmentDialog = (result: EnrichmentResult) => {
    setEnrichmentResult(result);
    setSelectedSuggestionFields(Object.keys(result.suggested_fields || {}));
    setEnrichmentDialogOpen(true);
  };

  const enrichableCultureIds = useMemo(
    () => cultures.filter((culture) => culture.id && canRunEnrichmentForCulture(culture) && cultureHasMissingEnrichmentFields(culture)).map((culture) => culture.id as number),
    [cultures],
  );



  const selectedCultureNeedsCompletion = useMemo(
    () => (selectedCulture ? cultureHasMissingEnrichmentFields(selectedCulture) : false),
    [selectedCulture],
  );

  const handleCancelEnrichment = useCallback(() => {
    if (!enrichmentLoadingRef.current) {
      return;
    }
    enrichmentAbortControllerRef.current?.abort();
    enrichmentAbortControllerRef.current = null;
    setEnrichmentLoading(false);
    showSnackbar(t('ai.cancelled'), 'success');
  }, [showSnackbar, t]);

  const handleEnrichCurrent = async (mode: 'complete' | 'reresearch') => {
    if (!selectedCulture?.id) return;
    const controller = new AbortController();
    enrichmentAbortControllerRef.current = controller;
    setEnrichmentLoading(true);
    handleAiMenuClose();
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
    handleAiMenuClose();
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

  const commandSpecs = useMemo(() => createCulturesCommandSpecs({
    canRunEnrichmentForCulture,
    cultures,
    enableAiEnrichment: aiEnrichmentEnabled,
    enrichmentLoading,
    goToRelativeCulture,
    handleCreateCulture: handleAddNew,
    handleCreatePlantingPlan,
    handleDelete,
    handleEdit,
    handleEnrichCurrent,
    handleExportAllCultures,
    handleExportCurrentCulture,
    handleImportFileTrigger,
    selectedCulture,
    selectedCultureId,
    setEnrichAllConfirmOpen,
  }), [
    aiEnrichmentEnabled,
    cultures,
    enrichmentLoading,
    goToRelativeCulture,
    handleAddNew,
    handleCreatePlantingPlan,
    handleDelete,
    handleEdit,
    handleEnrichCurrent,
    handleExportAllCultures,
    handleExportCurrentCulture,
    handleImportFileTrigger,
    selectedCulture,
    selectedCultureId,
  ]);

  useRegisterCommands('cultures-page', commandSpecs);


  const toggleSuggestionField = (field: string) => {
    setSelectedSuggestionFields((prev) => prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field]);
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
      await fetchCultures();
      showSnackbar(t('ai.applySuccess'), 'success');
      setEnrichmentDialogOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error applying enrichment suggestions:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('messages.updateError')), 'error');
    }
  };
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

  useEffect(() => {
    if (!aiEnrichmentEnabled) {
      return;
    }

    const onAiShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (isTypingInEditableElement(document.activeElement)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'u') {
        if (!selectedCultureNeedsCompletion) {
          return;
        }
        event.preventDefault();
        void handleEnrichCurrent('complete');
      } else if (key === 'r') {
        event.preventDefault();
        void handleEnrichCurrent('reresearch');
      } else if (key === 'a') {
        event.preventDefault();
        setEnrichAllConfirmOpen(true);
      }
    };

    window.addEventListener('keydown', onAiShortcut);
    return () => window.removeEventListener('keydown', onAiShortcut);
  }, [aiEnrichmentEnabled, handleEnrichAll, handleEnrichCurrent, selectedCultureNeedsCompletion]);



  return (
    <div className="page-container">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 2,
        }}
      >
        <h1>{t('title')}</h1>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', ml: 'auto' }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNew}>
            {t('buttons.addNew')}
          </Button>
          <Button variant="outlined" startIcon={<PublicIcon />} onClick={() => void handleOpenPublicLibrary()}>
            {t('library.openButton')}
          </Button>
          <IconButton
            size="small"
            aria-label={t('import.menuLabel')}
            aria-controls={importMenuAnchor ? 'culture-import-menu' : undefined}
            aria-haspopup="true"
            onClick={handleImportMenuOpen}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>
        <Menu
          id="culture-import-menu"
          anchorEl={importMenuAnchor}
          open={Boolean(importMenuAnchor)}
          onClose={handleImportMenuClose}
        >
          <MenuItem aria-label="JSON exportieren (Alt+J)" onClick={handleExportCurrentCulture} disabled={!selectedCulture}>
            JSON exportieren (Alt+J)
          </MenuItem>
          <MenuItem aria-label="Alle Kulturen exportieren (Alt+Shift+J)" onClick={handleExportAllCultures}>
            Alle Kulturen exportieren (Alt+Shift+J)
          </MenuItem>
          <MenuItem aria-label="JSON importieren (Alt+I)" onClick={handleImportFileTrigger}>
            JSON importieren (Alt+I)
          </MenuItem>
        </Menu>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFileChange}
          hidden
        />
      </Box>
      
      {enrichmentCostBanner && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {enrichmentCostBanner}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <CultureDetail
          cultures={cultures}
          isLoading={isCulturesLoading}
          selectedCultureId={selectedCultureId}
          onCultureSelect={handleCultureSelect}
        />
      </Box>

      {/* Action buttons for selected culture */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mb: 2,
          flexWrap: 'wrap',
          minHeight: 44,
          alignItems: 'center',
        }}
      >
          <Tooltip title="Vorherige Kultur (Alt+Shift+←)">
            <span>
              <Button aria-label="Vorherige Kultur (Alt+Shift+←)" variant="outlined" onClick={() => goToRelativeCulture('previous')} disabled={cultures.length < 2}>
                ←
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Nächste Kultur (Alt+Shift+→)">
            <span>
              <Button aria-label="Nächste Kultur (Alt+Shift+→)" variant="outlined" onClick={() => goToRelativeCulture('next')} disabled={cultures.length < 2}>
                →
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Anbauplan erstellen (Alt+P)">
            <span>
              <Button
                aria-label="Anbauplan erstellen (Alt+P)"
                variant="contained"
                startIcon={<AgricultureIcon />}
                onClick={handleCreatePlantingPlan}
                disabled={!selectedCulture}
              >
                {t('buttons.createPlantingPlan')}
              </Button>
            </span>
          </Tooltip>
          {aiEnrichmentEnabled && (
            <>
              <Tooltip title={!canRunEnrichmentForCulture(selectedCulture) ? enrichmentDisabledReason : ''}><span><ButtonGroup variant="contained" aria-label={t('ai.menuLabel')} disabled={!selectedCulture || enrichmentLoading || !canRunEnrichmentForCulture(selectedCulture)}>
            <Tooltip title={!selectedCultureNeedsCompletion && selectedCulture ? t('ai.completeDisabledReason') : ''}>
              <span>
                <Button
                  startIcon={<AutoAwesomeIcon />}
                  onClick={() => void handleEnrichCurrent('complete')}
                  aria-label="Kultur vervollständigen (KI) (Alt+U)"
                  disabled={Boolean(selectedCulture) && !selectedCultureNeedsCompletion}
                >
                  {t('buttons.aiComplete')}
                </Button>
              </span>
            </Tooltip>
            <Button
              size="small"
              aria-label={t('ai.menuLabel')}
              aria-controls={aiMenuAnchor ? 'culture-ai-menu' : undefined}
              aria-haspopup="true"
              onClick={handleAiMenuOpen}
              sx={{ minWidth: 32, px: 0.5 }}
            >
              <ArrowDropDownIcon />
            </Button>
          </ButtonGroup></span></Tooltip>
          <Menu
            id="culture-ai-menu"
            anchorEl={aiMenuAnchor}
            open={Boolean(aiMenuAnchor)}
            onClose={handleAiMenuClose}
          >
            <MenuItem aria-label="Kultur komplett neu recherchieren (KI) (Alt+R)" onClick={() => void handleEnrichCurrent('reresearch')} disabled={!selectedCulture || enrichmentLoading || !canRunEnrichmentForCulture(selectedCulture)}>
              <ManageSearchIcon sx={{ mr: 1 }} fontSize="small" />
              {t('buttons.aiReresearch')}
            </MenuItem>
            <MenuItem aria-label="Alle Kulturen vervollständigen (KI) (Alt+A)" onClick={() => setEnrichAllConfirmOpen(true)} disabled={cultures.length === 0 || enrichmentLoading || !cultures.some((culture) => canRunEnrichmentForCulture(culture))}>
              <PlaylistAddCheckIcon sx={{ mr: 1 }} fontSize="small" />
              {t('buttons.aiCompleteAll')}
            </MenuItem>
              </Menu>
            </>
          )}
          <Tooltip title="Kultur bearbeiten (Alt+E)">
            <span>
              <Button
                aria-label="Kultur bearbeiten (Alt+E)"
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => selectedCulture && handleEdit(selectedCulture)}
                disabled={!selectedCulture}
              >
                {t('buttons.edit')}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<PublicIcon />}
            onClick={() => void handlePublishCurrentCulture()}
            disabled={!selectedCulture || publishingCultureId === selectedCulture?.id}
          >
            {publishingCultureId === selectedCulture?.id
              ? (isUpdatingOwnPublicCulture ? t('library.updating') : t('library.publishing'))
              : (isUpdatingOwnPublicCulture ? t('library.updateButton') : t('library.publishButton'))}
          </Button>
          <Button variant="outlined" onClick={handleOpenHistory} disabled={!selectedCulture}>
            Versionen
          </Button>
          <Tooltip title="Kultur löschen (Alt+Shift+D)">
            <span>
              <Button
                aria-label="Kultur löschen (Alt+Shift+D)"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => selectedCulture && handleDelete(selectedCulture)}
                disabled={!selectedCulture}
              >
                {t('buttons.delete')}
              </Button>
            </span>
          </Tooltip>
          <Box sx={{ flexGrow: 1 }} />
      </Box>

      <PublicCultureLibraryDialog
        open={publicLibraryOpen}
        loading={publicLibraryLoading}
        error={publicLibraryError}
        cultures={publicCultures}
        importingId={publicLibraryImportingId}
        onClose={() => setPublicLibraryOpen(false)}
        onSearch={(query) => {
          void fetchPublicCultures(query);
        }}
        onImport={(culture) => {
          void handleImportPublicCulture(culture);
        }}
      />

      <Dialog open={Boolean(deleteDialogCulture)} onClose={() => setDeleteDialogCulture(null)}>
        <DialogTitle>{t('buttons.delete')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('buttons.deleteConfirm')}
          </Typography>
          {deleteDialogCulture && (
            <Typography sx={{ mt: 1, fontWeight: 600 }}>
              {getCultureLabel(deleteDialogCulture)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogCulture(null)}>Abbrechen</Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            {t('buttons.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Form Dialog */}
      <Dialog
        open={showForm}
        onClose={handleCancel}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          <CultureForm
            culture={editingCulture}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>

      <CulturesImportDialog
        open={importDialogOpen}
        importState={importState}
        hasImportableEntries={hasImportableEntries}
        confirmUpdates={confirmUpdates}
        onConfirmUpdatesChange={setConfirmUpdates}
        onClose={handleImportDialogClose}
        onImportStart={() => void handleImportStart()}
        t={t}
      />

      {aiEnrichmentEnabled && (<Dialog open={enrichAllConfirmOpen} onClose={() => setEnrichAllConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('ai.confirmAllTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('ai.confirmAllText', { count: enrichableCultureIds.length })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnrichAllConfirmOpen(false)}>{t('buttons.aiClose')}</Button>
          <Button variant="contained" onClick={() => void handleEnrichAll()}>{t('buttons.aiCompleteAll')}</Button>
        </DialogActions>
      </Dialog>)}

      {aiEnrichmentEnabled && (
        <EnrichmentLoadingDialog
          open={enrichmentLoading}
          elapsedSeconds={enrichmentElapsedSeconds}
          progressPercent={enrichmentProgressPercent}
          activeStepIndex={enrichmentActiveStepIndex}
          steps={enrichmentLoadingSteps}
          t={t}
        />
      )}

      {aiEnrichmentEnabled && (<Dialog open={enrichmentDialogOpen} onClose={() => setEnrichmentDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('ai.suggestionsTitle')}</DialogTitle>
        <DialogContent>
          {dialogCostInfo && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {dialogCostInfo}
            </Alert>
          )}
          {(enrichmentResult?.validation?.warnings || []).length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {(enrichmentResult?.validation?.warnings || []).map((warning) => (
                <Typography key={`${warning.field}-${warning.code}`} variant="body2">
                  • {formatEnrichmentWarning(warning, t)}
                </Typography>
              ))}
            </Alert>
          )}
          {!enrichmentResult || Object.keys(enrichmentResult.suggested_fields || {}).length === 0 ? (
            <Typography>{t('ai.noSuggestions')}</Typography>
          ) : (
            <List>
              {Object.entries(enrichmentResult.suggested_fields).map(([field, suggestion]) => (
                <ListItem key={field} sx={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 1 }}>
                    <input
                      type="checkbox"
                      checked={selectedSuggestionFields.includes(field)}
                      onChange={() => toggleSuggestionField(field)}
                    />
                    <ListItemText
                      primary={`${getEnrichmentFieldLabel(field, t)}: ${formatSuggestionValue(field, suggestion.value, t)}`}
                      secondary={`${t('ai.confidence')}: ${(suggestion.confidence * 100).toFixed(0)}%`}
                    />
                  </Box>
                  {(enrichmentResult.evidence[field] || []).length > 0 && (
                    <Box sx={{ pl: 4 }}>
                      <Typography variant="caption">{t('ai.evidence')}:</Typography>
                      {(enrichmentResult.evidence[field] || []).map((ev) => (
                        <Typography key={`${field}-${ev.source_url}`} variant="caption" display="block">
                          • <a href={ev.source_url} target="_blank" rel="noreferrer">{ev.title || ev.source_url}</a>
                        </Typography>
                      ))}
                    </Box>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnrichmentDialogOpen(false)}>{t('buttons.aiClose')}</Button>
          <Button variant="contained" onClick={handleApplySuggestions} disabled={selectedSuggestionFields.length === 0}>
            {t('buttons.aiApplySelected')}
          </Button>
        </DialogActions>
      </Dialog>)}

      {/* Snackbar for notifications */}

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="sm"> 
        <DialogTitle>
          {historyScope === 'project'
            ? t('history.titles.project')
            : historyScope === 'global'
              ? t('history.titles.global')
              : t('history.titles.culture')}
        </DialogTitle>
        <DialogContent>
          <List>
            {historyItems.map((item) => {
              const historyTarget = getHistoryEntryTarget(item);
              return (
                <ListItem key={item.history_id} disableGutters>
                  <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ width: '100%' }}>
                    <ListItemText
                      sx={{ mr: 1 }}
                      primary={(
                        <>
                          {getHistoryEntryTitle(item, t)}
                          {historyTarget ? (
                            <>
                              {' · '}
                              <Link component={RouterLink} to={historyTarget} underline="hover" onClick={() => setHistoryOpen(false)}>
                                {item.object_type === 'culture' ? t('history.objectTypes.culture') : t('history.objectTypes.plantingPlan')}
                              </Link>
                            </>
                          ) : null}
                        </>
                      )}
                      secondary={getHistoryEntryMeta(item, t, fallbackHistoryActorLabel)}
                    />
                    <Button onClick={() => handleRestoreVersion(item.history_id)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {t('history.restoreButton')}
                    </Button>
                  </Stack>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>{t('history.closeButton')}</Button>
        </DialogActions>
      </Dialog>



      <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Tastenkürzel</DialogTitle>
        <DialogContent>
          <List dense>
            <ListItem>
              <ListItemText primary="Tastenkürzel öffnen" secondary="?" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Command Palette" secondary="Alt+K" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Dialog schließen" secondary="Esc" />
            </ListItem>
            {aiEnrichmentEnabled && (
              <>
                <ListItem>
                  <ListItemText primary="KI: Kultur vervollständigen" secondary="Alt+U" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="KI: Kultur neu recherchieren" secondary="Alt+R" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="KI: Alle Kulturen vervollständigen" secondary="Alt+A" />
                </ListItem>
              </>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShortcutsOpen(false)}>Schließen</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
export default Cultures;
