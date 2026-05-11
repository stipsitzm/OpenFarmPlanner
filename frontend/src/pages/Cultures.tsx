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
import { Link as RouterLink, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from '../i18n';
import PageContainer from '../components/layout/PageContainer';
import { bedAPI, cultureAPI, fieldAPI, locationAPI, publicCultureAPI, type Culture, type EnrichmentResult } from '../api/api';
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
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Tooltip,
  Typography,
  Link,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
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
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { getFirstMissingCultivationPlanRequirement } from './requirementFlow';
import type { RootLayoutOutletContext, TopbarContextAction } from '../App';
import { useTopbarContextActions } from '../hooks/useTopbarContextActions';

function Cultures(): React.ReactElement {
  const { t } = useTranslation('cultures');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions ?? (() => undefined);
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const { selectedCultureId, updateSelectedCultureId } = useSelectedCultureSync();
  const fallbackHistoryActorLabel = user?.display_label || user?.display_name || user?.email || undefined;

  const [cultures, setCultures] = useState<Culture[]>([]);
  const [isCulturesLoading, setIsCulturesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | undefined>(undefined);
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
  const [hasLocations, setHasLocations] = useState(false);
  const [hasFields, setHasFields] = useState(false);
  const [hasBeds, setHasBeds] = useState(false);
  const selectedCulture = cultures.find((culture) => culture.id === selectedCultureId);

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
    if (shouldShowProjectRequiredState) {
      setCultures([]);
      setIsCulturesLoading(false);
      setHasLocations(false);
      setHasFields(false);
      setHasBeds(false);
      return;
    }
    // eslint-disable-next-line -- Data fetching on mount is intentional
    fetchCultures();
  }, [fetchCultures, shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    const fetchPlanRequirements = async (): Promise<void> => {
      try {
        const [locationsResponse, fieldsResponse, bedsResponse] = await Promise.all([
          locationAPI.list(),
          fieldAPI.list(),
          bedAPI.list(),
        ]);
        setHasLocations(locationsResponse.data.results.length > 0);
        setHasFields(fieldsResponse.data.results.length > 0);
        setHasBeds(bedsResponse.data.results.length > 0);
      } catch {
        setHasLocations(false);
        setHasFields(false);
        setHasBeds(false);
      }
    };
    void fetchPlanRequirements();
  }, [shouldShowProjectRequiredState]);


  useEffect(() => {
    if (cultures.length === 0) {
      return;
    }

    if (selectedCultureId === undefined && !showForm) {
      const [firstCulture] = cultures;
      if (firstCulture?.id !== undefined) {
        updateSelectedCultureId(firstCulture.id, 'internal');
      }
      return;
    }

    if (selectedCultureId !== undefined && !cultures.some((culture) => culture.id === selectedCultureId)) {
      updateSelectedCultureId(undefined, 'internal');
    }
  }, [cultures, selectedCultureId, showForm, updateSelectedCultureId]);

  const handleCultureSelect = (culture: Culture | null) => {
    updateSelectedCultureId(culture?.id, 'internal');
  };

  const handleAddNew = () => {
    setEditingCulture(undefined);
    setShowForm(true);
  };

  useEffect(() => {
    if (shouldShowProjectRequiredState || showForm) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('create') !== 'true') {
      return;
    }

    handleAddNew();
    searchParams.delete('create');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, shouldShowProjectRequiredState, showForm]);

  const handleEdit = (culture: Culture) => {
    setEditingCulture(culture);
    setShowForm(true);
  };

  const handleDelete = (culture: Culture) => {
    setDeleteDialogCulture(culture);
  };

  const handleOpenHistory = async () => {
    if (!selectedCulture?.id) {
      return;
    }
    const response = await cultureAPI.history(selectedCulture.id);
    if (response.data.length <= 1) {
      showSnackbar(t('history.emptyState.title', { defaultValue: 'Keine weiteren Versionen verfügbar.' }), 'info');
      return;
    }
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

  const handleOpenPublicLibrary = useCallback(async () => {
    setPublicLibraryOpen(true);
    await fetchPublicCultures();
  }, [fetchPublicCultures]);

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

  const handleImportFileTrigger = useCallback(() => {
    resetImportState();
    fileInputRef.current?.click();
  }, [resetImportState]);

  const handleExportCurrentCulture = useCallback(() => {
    if (!selectedCulture) {
      return;
    }

    const exportPayload = buildSingleCultureExport(selectedCulture);
    const filename = buildSingleCultureFilename(selectedCulture);
    downloadJsonFile(exportPayload, filename);
    showSnackbar(t('messages.exportSuccess'), 'success');
  }, [selectedCulture, showSnackbar, t]);

  const handleExportAllCultures = useCallback(async () => {
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
    }
  }, [showSnackbar, t]);

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

  const firstMissingPlanRequirement = getFirstMissingCultivationPlanRequirement({
    hasLocations,
    hasFields,
    hasBeds,
    hasCultures: cultures.length > 0,
  });
  const canCreatePlantingPlan = Boolean(selectedCulture) && firstMissingPlanRequirement === null;
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


  const contextActions = useMemo<TopbarContextAction[]>(() => ([
    {
      id: 'cultures-open-library',
      label: 'Kulturbibliothek öffnen',
      ariaLabel: 'Kulturbibliothek öffnen',
      onClick: () => {
        void handleOpenPublicLibrary();
      },
    },
    {
      id: 'cultures-import-json',
      label: 'Kulturen importieren (JSON)',
      ariaLabel: 'Kulturen importieren (JSON)',
      onClick: handleImportFileTrigger,
      shortcutHint: 'Alt+I',
    },
    {
      id: 'cultures-export-current-json',
      label: selectedCulture ? 'Aktuelle Kultur exportieren (JSON)' : 'Kulturen exportieren (JSON)',
      ariaLabel: selectedCulture ? 'Aktuelle Kultur exportieren (JSON)' : 'Kulturen exportieren (JSON)',
      onClick: handleExportCurrentCulture,
      disabled: !selectedCulture,
      shortcutHint: 'Alt+J',
    },
    {
      id: 'cultures-export-all-json',
      label: 'Alle Kulturen exportieren (JSON)',
      ariaLabel: 'Alle Kulturen exportieren (JSON)',
      onClick: handleExportAllCultures,
      shortcutHint: 'Alt+Shift+J',
    },
  ]), [handleExportAllCultures, handleExportCurrentCulture, handleImportFileTrigger, handleOpenPublicLibrary, selectedCulture]);

  useTopbarContextActions(setTopbarContextActions, contextActions);

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

 



  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="xwide">
        <ProjectRequiredState reason={missingProjectReason} />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="xwide">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFileChange}
          hidden
        />
      
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
          onCreateCulture={handleAddNew}
          onOpenPublicLibrary={() => {
            void handleOpenPublicLibrary();
          }}
          onEditCulture={handleEdit}
          onCreatePlan={handleCreatePlantingPlan}
          onOpenHistory={handleOpenHistory}
          onPublishCulture={() => {
            void handlePublishCurrentCulture();
          }}
          onDeleteCulture={handleDelete}
          canCreatePlan={canCreatePlantingPlan}
          isPublishingCulture={Boolean(selectedCulture && publishingCultureId === selectedCulture.id)}
          publishActionLabel={publishingCultureId === selectedCulture?.id
            ? (isUpdatingOwnPublicCulture ? t('library.updating') : t('library.publishing'))
            : (isUpdatingOwnPublicCulture
              ? t('library.updateButton')
              : t('library.publishButton'))}
        />
      </Box>
      {cultures.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {firstMissingPlanRequirement === 'beds' ? (
            <EmptyStateCard
              title={t('buttons.createPlantingPlanMissingBedsTitle')}
              description={t('buttons.createPlantingPlanDisabled.beds')}
              actions={[{ label: t('buttons.goToFieldsBeds'), to: '/app/fields-beds' }]}
              containerSx={{
                backgroundColor: 'rgba(76, 175, 80, 0.06)',
                borderLeft: '3px solid',
                borderLeftColor: 'success.main',
                py: 1.25,
                px: 1.5,
              }}
              titleSx={{ fontWeight: 500 }}
            />
          ) : null}

          {aiEnrichmentEnabled && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Tooltip title={!canRunEnrichmentForCulture(selectedCulture) ? enrichmentDisabledReason : ''}><span><ButtonGroup variant="contained" aria-label={t('ai.menuLabel')} disabled={!selectedCulture || enrichmentLoading || !canRunEnrichmentForCulture(selectedCulture)}>
            <Tooltip title={!selectedCultureNeedsCompletion && selectedCulture ? t('ai.completeDisabledReason') : ''}>
                <span>
                  <Button
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => void handleEnrichCurrent('complete')}
                    aria-label="Kultur vervollständigen (KI)"
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
              <MenuItem aria-label="Kultur komplett neu recherchieren (KI)" onClick={() => void handleEnrichCurrent('reresearch')} disabled={!selectedCulture || enrichmentLoading || !canRunEnrichmentForCulture(selectedCulture)}>
                <ManageSearchIcon sx={{ mr: 1 }} fontSize="small" />
                {t('buttons.aiReresearch')}
              </MenuItem>
              <MenuItem aria-label="Alle Kulturen vervollständigen (KI)" onClick={() => setEnrichAllConfirmOpen(true)} disabled={cultures.length === 0 || enrichmentLoading || !cultures.some((culture) => canRunEnrichmentForCulture(culture))}>
                <PlaylistAddCheckIcon sx={{ mr: 1 }} fontSize="small" />
                {t('buttons.aiCompleteAll')}
              </MenuItem>
                </Menu>
            </Box>
          )}

        </Box>
      )}

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
        <DialogContent sx={{ pt: historyItems.length === 0 ? 1 : 2, pb: historyItems.length === 0 ? 1 : 2 }}>
          {historyItems.length === 0 ? (
            <Box sx={{ py: isMobile ? 0.5 : 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t('history.emptyState.title', { defaultValue: 'Keine weiteren Versionen verfügbar.' })}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('history.emptyState.description', { defaultValue: 'Für diese Sorte existiert aktuell nur diese Version.' })}
              </Typography>
            </Box>
          ) : (
            <List>
              {historyItems.map((item) => {
                const historyTarget = getHistoryEntryTarget(item);
                const mobileTitle = getHistoryEntryTitle(item, t);
                const mobileMeta = getHistoryEntryMeta(item, t, fallbackHistoryActorLabel);
                return (
                  <ListItem key={item.history_id} disableGutters sx={{ mb: isMobile ? 1 : 0 }}>
                    {isMobile ? (
                      <Paper variant="outlined" sx={{ width: '100%', p: 1.25, borderRadius: 1.5 }}>
                        <Stack spacing={1}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Chip
                              size="small"
                              label={item.object_type === 'culture' ? t('history.objectTypes.culture') : t('history.objectTypes.plantingPlan')}
                              variant="outlined"
                            />
                            {historyTarget ? (
                              <Link
                                component={RouterLink}
                                to={historyTarget}
                                underline="hover"
                                onClick={() => setHistoryOpen(false)}
                                sx={{ fontSize: '0.78rem', color: 'text.secondary', flexShrink: 0 }}
                              >
                                {t('history.objectTypes.openTarget', { defaultValue: 'Öffnen' })}
                              </Link>
                            ) : null}
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              lineHeight: 1.35,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              wordBreak: 'normal',
                              overflowWrap: 'break-word',
                            }}
                          >
                            {mobileTitle}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              lineHeight: 1.3,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              wordBreak: 'normal',
                              overflowWrap: 'break-word',
                            }}
                          >
                            {mobileMeta}
                          </Typography>
                          <Divider />
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleRestoreVersion(item.history_id)}
                            sx={{ alignSelf: 'flex-start', minHeight: 34 }}
                          >
                            {t('history.restoreButton')}
                          </Button>
                        </Stack>
                      </Paper>
                    ) : (
                      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ width: '100%' }}>
                        <ListItemText
                          sx={{ mr: 1 }}
                          primary={(
                            <>
                              {mobileTitle}
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
                          secondary={mobileMeta}
                        />
                        <Button onClick={() => handleRestoreVersion(item.history_id)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {t('history.restoreButton')}
                        </Button>
                      </Stack>
                    )}
                  </ListItem>
                );
              })}
            </List>
          )}
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
              <ListItemText primary="Command Palette" secondary="Ctrl+K" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Dialog schließen" secondary="Esc" />
            </ListItem>
            {aiEnrichmentEnabled && (
              <>
                <ListItem>
                  <ListItemText primary="KI: Kultur vervollständigen" secondary="–" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="KI: Kultur neu recherchieren" secondary="–" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="KI: Alle Kulturen vervollständigen" secondary="–" />
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
        autoHideDuration={4200}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiAlert-root': {
            borderRadius: 2,
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.12)',
          },
        }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{
            width: '100%',
            alignItems: 'center',
            fontWeight: 500,
            bgcolor: snackbar.severity === 'info' ? 'rgba(37, 111, 42, 0.96)' : undefined,
            color: snackbar.severity === 'info' ? '#ffffff' : undefined,
            '& .MuiAlert-icon': {
              color: snackbar.severity === 'info' ? '#ffffff' : undefined,
            },
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}
export default Cultures;
