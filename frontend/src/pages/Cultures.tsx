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
import { bedAPI, cultureAPI, fieldAPI, publicCultureAPI, type Culture, type EnrichmentResult } from '../api/api';
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
import { useCommandContextTag, useRegisterCommands, useRegisterCreateActions } from '../commands/useCommandContext';
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
import { parseSpreadsheetFile } from '../cultures/spreadsheetImport';
import { exportCulturesToSpreadsheet, buildSpreadsheetFilename, type SpreadsheetExportFormat } from '../cultures/spreadsheetExport';
import { createCulturesCommandSpecs } from './culturesCommandSpecs';
import { canRunEnrichmentForCulture, cultureHasMissingEnrichmentFields } from './culturesAiUtils';
import { buildCultureSavePayload } from './culturesSaveUtils';
import {
  formatHistoryChangeValue,
  getHistoryChangeFieldLabel,
  getHistoryEntryMeta,
  getHistoryEntryTarget,
  getHistoryEntryTitle,
  isCurrentHistoryEntry,
  type HistoryScope,
} from './culturesHistoryUtils';
import { useSelectedCultureSync } from './useSelectedCultureSync';
import { FEATURES } from '../config/features';
import { useAuth } from '../auth/useAuth';
import { dedupePublicCultures } from './publicCultureUtils';
import { useCultureImportState } from './useCultureImportState';
import { useEnrichmentLoadingProgress } from './useEnrichmentLoadingProgress';
import { CulturesImportDialog } from './CulturesImportDialog';
import { CulturesImportStartDialog } from './CulturesImportStartDialog';
import { CulturesExportDialog } from './CulturesExportDialog';
import { EnrichmentLoadingDialog } from './EnrichmentLoadingDialog';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import EmptyStateCard from '../components/project/EmptyStateCard';
import { getFirstMissingCultivationPlanRequirement, getProjectSetupAction } from './requirementFlow';
import type { RootLayoutOutletContext, TopbarContextAction } from '../App';
import { useTopbarContextActions } from '../hooks/useTopbarContextActions';
import {
  DeleteUndoSnackbar,
  DELETE_UNDO_DURATION_MS,
} from '../components/data-grid';

interface PendingCultureDeletion {
  id: string;
  cultureId: number;
  culture: Culture;
  culturesBeforeDelete: Culture[];
  selectedCultureIdBeforeDelete?: number;
  visible: boolean;
}

function Cultures() {
  const { t } = useTranslation(['cultures', 'common']);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions;
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  const { selectedCultureId, updateSelectedCultureId } = useSelectedCultureSync();
  const fallbackHistoryActorLabel = user?.display_label || user?.display_name || user?.email || undefined;

  const [cultures, setCultures] = useState<Culture[]>([]);
  const [isCulturesLoading, setIsCulturesLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | undefined>(undefined);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importStartDialogOpen, setImportStartDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
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
  const [pendingCultureDeletions, setPendingCultureDeletions] = useState<PendingCultureDeletion[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<CultureHistoryEntry[]>([]);
  const [historyScope, setHistoryScope] = useState<HistoryScope>('culture');
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
  const pendingCultureDeleteTimersRef = useRef<Map<string, number>>(new Map());
  const [publicLibraryOpen, setPublicLibraryOpen] = useState(false);
  const [publicLibraryLoading, setPublicLibraryLoading] = useState(false);
  const [publicLibraryError, setPublicLibraryError] = useState<string | null>(null);
  const [publicCultures, setPublicCultures] = useState<PublicCulture[]>([]);
  const [publicLibraryImportingId, setPublicLibraryImportingId] = useState<number | null>(null);
  const [publicLibraryInitialSelectedId, setPublicLibraryInitialSelectedId] = useState<number | null>(null);
  const [publicLibraryInitialQuery, setPublicLibraryInitialQuery] = useState('');
  const [publishingCultureId, setPublishingCultureId] = useState<number | null>(null);
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


  const replaceSavedCulture = useCallback((savedCulture: Culture): void => {
    setCultures((currentCultures) => {
      const savedCultureId = savedCulture.id;
      if (savedCultureId === undefined) {
        return currentCultures;
      }

      const cultureExists = currentCultures.some((culture) => culture.id === savedCultureId);
      if (!cultureExists) {
        return [...currentCultures, savedCulture];
      }

      return currentCultures.map((culture) => (
        culture.id === savedCultureId ? savedCulture : culture
      ));
    });
  }, []);

  const fetchCultures = useCallback(async (preservedCulture?: Culture) => {
    setIsCulturesLoading(true);
    try {
      const response = await cultureAPI.list();
      const fetchedCultures = response.data.results;
      if (!preservedCulture?.id) {
        setCultures(fetchedCultures);
        return;
      }

      const preservedCultureId = preservedCulture.id;
      const fetchedCultureIds = new Set(fetchedCultures.map((culture) => culture.id));
      const nextCultures = fetchedCultures.map((culture) => (
        culture.id === preservedCultureId
          ? { ...culture, ...preservedCulture }
          : culture
      ));
      setCultures(
        fetchedCultureIds.has(preservedCultureId)
          ? nextCultures
          : [...nextCultures, preservedCulture],
      );
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
        const [fieldsResponse, bedsResponse] = await Promise.all([
          fieldAPI.list(),
          bedAPI.list(),
        ]);
        setHasFields(fieldsResponse.data.results.length > 0);
        setHasBeds(bedsResponse.data.results.length > 0);
      } catch {
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

  const handleAddNew = useCallback(() => {
    setEditingCulture(undefined);
    setShowForm(true);
  }, []);

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
  }, [handleAddNew, location.pathname, location.search, navigate, shouldShowProjectRequiredState, showForm]);

  const handleEdit = useCallback((culture: Culture) => {
    setEditingCulture(culture);
    setShowForm(true);
  }, []);

  useEffect(() => {
    if (shouldShowProjectRequiredState || showForm || !selectedCulture) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('action') !== 'edit' || searchParams.get('cultureId') !== String(selectedCulture.id)) {
      return;
    }

    handleEdit(selectedCulture);
    searchParams.delete('action');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [handleEdit, location.pathname, location.search, navigate, selectedCulture, shouldShowProjectRequiredState, showForm]);

  const handleDelete = (culture: Culture) => {
    setDeleteDialogCulture(culture);
  };

  const removePendingCultureDeletion = useCallback((deletionId: string): void => {
    setPendingCultureDeletions((currentDeletions) =>
      currentDeletions.filter((deletion) => deletion.id !== deletionId),
    );
  }, []);

  const restorePendingCultureDeletion = useCallback((deletion: PendingCultureDeletion): void => {
    setCultures((currentCultures) => {
      if (currentCultures.some((culture) => culture.id === deletion.cultureId)) {
        return currentCultures;
      }
      const currentById = new Map<number, Culture>();
      currentCultures.forEach((culture) => {
        if (typeof culture.id === 'number') {
          currentById.set(culture.id, culture);
        }
      });
      currentById.set(deletion.cultureId, deletion.culture);
      const restoredCultures = deletion.culturesBeforeDelete
        .map((culture) => (typeof culture.id === 'number' ? currentById.get(culture.id) : culture))
        .filter((culture): culture is Culture => Boolean(culture));
      const restoredIds = new Set(restoredCultures.map((culture) => culture.id));
      return [
        ...restoredCultures,
        ...currentCultures.filter((culture) => !restoredIds.has(culture.id)),
      ];
    });
    if (deletion.selectedCultureIdBeforeDelete === deletion.cultureId) {
      updateSelectedCultureId(deletion.cultureId, 'internal');
    }
  }, [updateSelectedCultureId]);

  const expirePendingCultureDeletion = useCallback((deletion: PendingCultureDeletion): void => {
    pendingCultureDeleteTimersRef.current.delete(deletion.id);
    removePendingCultureDeletion(deletion.id);
  }, [removePendingCultureDeletion]);

  const undoPendingCultureDeletion = useCallback(async (deletionId: string): Promise<void> => {
    const deletion = pendingCultureDeletions.find((pendingDeletion) => pendingDeletion.id === deletionId);
    if (!deletion) {
      return;
    }

    const timerId = pendingCultureDeleteTimersRef.current.get(deletionId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      pendingCultureDeleteTimersRef.current.delete(deletionId);
    }

    try {
      await cultureAPI.undelete(deletion.cultureId);
      restorePendingCultureDeletion(deletion);
      removePendingCultureDeletion(deletionId);
    } catch (error) {
      console.error('Error restoring culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('messages.restoreDeleteError')), 'error');
    }
  }, [pendingCultureDeletions, removePendingCultureDeletion, restorePendingCultureDeletion, showSnackbar, t]);

  const closePendingCultureDeletionSnackbar = useCallback((deletionId: string): void => {
    setPendingCultureDeletions((currentDeletions) =>
      currentDeletions.map((deletion) =>
        deletion.id === deletionId ? { ...deletion, visible: false } : deletion,
      ),
    );
  }, []);

  useEffect(() => {
    return () => {
      pendingCultureDeleteTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      pendingCultureDeleteTimersRef.current.clear();
    };
  }, []);

  const handleOpenHistory = async () => {
    if (!selectedCulture?.id) {
      return;
    }
    const response = await cultureAPI.history(selectedCulture.id);
    if (response.data.length <= 1) {
      showSnackbar(t('history.emptyState.title'), 'info');
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


  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteDialogCulture?.id) {
      return;
    }

    const cultureId = deleteDialogCulture.id;
    if (pendingCultureDeletions.some((deletion) => deletion.cultureId === cultureId)) {
      setDeleteDialogCulture(null);
      return;
    }

    const deletionId = `culture-${cultureId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const currentCultures = cultures;
    const deletedCultureIndex = currentCultures.findIndex((culture) => culture.id === cultureId);
    const pendingDeletion: PendingCultureDeletion = {
      id: deletionId,
      cultureId,
      culture: deleteDialogCulture,
      culturesBeforeDelete: currentCultures,
      selectedCultureIdBeforeDelete: selectedCultureId,
      visible: true,
    };

    setDeleteDialogCulture(null);

    try {
      await cultureAPI.delete(cultureId);
    } catch (error) {
      console.error('Error deleting culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('messages.deleteError')), 'error');
      return;
    }

    setCultures((currentItems) => currentItems.filter((culture) => culture.id !== cultureId));
    if (selectedCultureId === cultureId) {
      const nextSelectedCulture =
        currentCultures[deletedCultureIndex + 1] ??
        currentCultures[deletedCultureIndex - 1] ??
        null;
      updateSelectedCultureId(nextSelectedCulture?.id, 'internal');
    }
    setPendingCultureDeletions((currentDeletions) => [...currentDeletions, pendingDeletion]);

    const timerId = window.setTimeout(() => {
      expirePendingCultureDeletion(pendingDeletion);
    }, DELETE_UNDO_DURATION_MS);
    pendingCultureDeleteTimersRef.current.set(deletionId, timerId);
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
      replaceSavedCulture(savedCulture);
      setShowForm(false);
      setEditingCulture(undefined);
      void fetchCultures(savedCulture);
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

  const fetchPublicCultures = useCallback(async (
    query = '',
    exactMatch?: { name: string; variety?: string },
  ) => {
    try {
      setPublicLibraryLoading(true);
      setPublicLibraryError(null);
      const params = exactMatch
        ? { name: exactMatch.name, variety: exactMatch.variety || '' }
        : query ? { q: query } : undefined;
      const response = await publicCultureAPI.list(params);
      setPublicCultures(dedupePublicCultures(response.data.results));
    } catch (error) {
      console.error('Error fetching public cultures:', error);
      setPublicLibraryError(t('library.loadError'));
    } finally {
      setPublicLibraryLoading(false);
    }
  }, [t]);

  const handleOpenPublicLibrary = useCallback(async () => {
    setPublicLibraryInitialSelectedId(null);
    setPublicLibraryInitialQuery('');
    setPublicLibraryOpen(true);
    await fetchPublicCultures();
  }, [fetchPublicCultures]);

  const handleViewPublicLibraryMatch = useCallback(async (match: Pick<PublicCulture, 'id' | 'name' | 'variety'>) => {
    setShowForm(false);
    setEditingCulture(undefined);
    setPublicLibraryInitialSelectedId(match.id);
    setPublicLibraryInitialQuery(`${match.name} ${match.variety || ''}`.trim());
    setPublicLibraryOpen(true);
    await fetchPublicCultures('', { name: match.name, variety: match.variety });
  }, [fetchPublicCultures]);

  useEffect(() => {
    if (shouldShowProjectRequiredState || publicLibraryOpen) {
      return;
    }
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('library') !== 'true') {
      return;
    }

    void handleOpenPublicLibrary();
    searchParams.delete('library');
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    );
  }, [handleOpenPublicLibrary, location.pathname, location.search, navigate, publicLibraryOpen, shouldShowProjectRequiredState]);

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
    setImportStartDialogOpen(true);
  }, [resetImportState]);

  const handleImportFileSelected = useCallback(async (file: File) => {
    setImportStartDialogOpen(false);
    resetImportState();

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isSpreadsheet = ['xlsx', 'ods', 'csv'].includes(ext);

    if (isSpreadsheet) {
      try {
        const { entries, skippedRows, warnings } = await parseSpreadsheetFile(file);

        if (entries.length === 0) {
          const warningText = warnings.length > 0 ? warnings.join(' ') : t('import.errors.noValidEntries');
          setImportErrorState({ error: warningText, previewCount: skippedRows, validCount: 0, invalidEntries: [] });
          setImportDialogOpen(true);
          return;
        }

        setImportUploading();
        try {
          const response = await cultureAPI.importPreview(entries);
          const invalidEntries: string[] = [];
          if (skippedRows > 0) {
            invalidEntries.push(t('import.skippedRows', { count: skippedRows }));
          }
          if (warnings.length > 0) {
            warnings.forEach((w) => invalidEntries.push(w));
          }
          setPreviewReadyState({
            previewCount: entries.length + skippedRows,
            validCount: entries.length,
            invalidEntries,
            payload: entries,
            previewResults: response.data.results,
          });
          setImportDialogOpen(true);
        } catch (error) {
          console.error('Error calling preview endpoint:', error);
          setImportErrorState({ error: t('import.errors.network') });
          setImportDialogOpen(true);
        }
      } catch (error) {
        console.error('Error parsing spreadsheet file:', error);
        setImportErrorState({ error: t('import.errors.parse') });
        setImportDialogOpen(true);
      }
      return;
    }

    if (ext === 'json') {
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
      return;
    }

    setImportErrorState({ error: t('import.errors.unsupportedFormat') });
    setImportDialogOpen(true);
  }, [resetImportState, t, setImportErrorState, setImportUploading, setPreviewReadyState]);

  const handleOpenExportDialog = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const handleExport = useCallback(async (scope: 'current' | 'all', format: SpreadsheetExportFormat | 'json') => {
    try {
      if (format === 'json') {
        if (scope === 'current' && selectedCulture) {
          const exportPayload = buildSingleCultureExport(selectedCulture);
          const filename = buildSingleCultureFilename(selectedCulture);
          downloadJsonFile(exportPayload, filename);
        } else {
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
        }
      } else {
        const culturesToExport: Culture[] = [];
        if (scope === 'current' && selectedCulture) {
          culturesToExport.push(selectedCulture);
        } else {
          let nextUrl: string | null = '/cultures/';
          while (nextUrl) {
            const response = await cultureAPI.list(nextUrl);
            culturesToExport.push(...response.data.results);
            nextUrl = response.data.next;
          }
        }
        const filename = buildSpreadsheetFilename(format, scope === 'current' ? 'single' : 'all', selectedCulture ?? undefined);
        exportCulturesToSpreadsheet(culturesToExport, format, filename);
      }
      showSnackbar(t('export.success'), 'success');
    } catch (error) {
      console.error('Error exporting cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    }
  }, [selectedCulture, showSnackbar, t]);

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
    hasFields,
    hasBeds,
    hasCultures: cultures.length > 0,
  });
  const firstMissingPlanAction = firstMissingPlanRequirement
    ? getProjectSetupAction(firstMissingPlanRequirement)
    : null;
  const canCreatePlantingPlan = Boolean(selectedCulture) && firstMissingPlanRequirement === null;
  const isUpdatingOwnPublicCulture = Boolean(selectedCulture?.owned_public_culture_id);
  const dialogCostInfo = getDialogCostInfo(enrichmentResult);

  useCommandContextTag('cultures');

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

  const enrichmentDisabledReason = t('ai.researchDisabledReason');

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
      id: 'cultures-import',
      label: t('import.menuLabel'),
      ariaLabel: t('import.menuLabel'),
      onClick: handleImportFileTrigger,
    },
    {
      id: 'cultures-export',
      label: t('export.menuLabel'),
      ariaLabel: t('export.menuLabel'),
      onClick: handleOpenExportDialog,
    },
  ]), [handleImportFileTrigger, handleOpenExportDialog, handleOpenPublicLibrary, t]);

  useTopbarContextActions(setTopbarContextActions, contextActions);

  const createActions = useMemo(() => [
    {
      id: 'create-culture',
      label: 'Kultur hinzufügen',
      shortcut: 'Alt+Shift+N',
      handler: handleAddNew,
    },
  ], [handleAddNew]);

  useRegisterCreateActions('cultures-page', createActions);

  const handleExportCurrentCulture = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const handleExportAllCultures = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const commandSpecs = useMemo(() => createCulturesCommandSpecs({
    canRunEnrichmentForCulture,
    cultures,
    enableAiEnrichment: aiEnrichmentEnabled,
    enrichmentLoading,
    goToRelativeCulture,
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
          {firstMissingPlanRequirement === 'fields' ? (
            <EmptyStateCard
              title={t('buttons.createPlantingPlanMissingFieldsTitle')}
              description={t('buttons.createPlantingPlanDisabled.fields')}
              actions={firstMissingPlanAction ? [{ label: t(firstMissingPlanAction.labelKey), to: firstMissingPlanAction.to }] : []}
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

          {firstMissingPlanRequirement === 'beds' ? (
            <EmptyStateCard
              title={t('buttons.createPlantingPlanMissingBedsTitle')}
              description={t('buttons.createPlantingPlanDisabled.beds')}
              actions={firstMissingPlanAction ? [{ label: t(firstMissingPlanAction.labelKey), to: firstMissingPlanAction.to }] : []}
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
                    aria-label={t('buttons.aiComplete')}
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
              <MenuItem aria-label={t('buttons.aiReresearch')} onClick={() => void handleEnrichCurrent('reresearch')} disabled={!selectedCulture || enrichmentLoading || !canRunEnrichmentForCulture(selectedCulture)}>
                <ManageSearchIcon sx={{ mr: 1 }} fontSize="small" />
                {t('buttons.aiReresearch')}
              </MenuItem>
              <MenuItem aria-label={t('buttons.aiCompleteAll')} onClick={() => setEnrichAllConfirmOpen(true)} disabled={cultures.length === 0 || enrichmentLoading || !cultures.some((culture) => canRunEnrichmentForCulture(culture))}>
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
        initialSelectedId={publicLibraryInitialSelectedId}
        initialQuery={publicLibraryInitialQuery}
        onClose={() => setPublicLibraryOpen(false)}
        onSearch={(query) => {
          void fetchPublicCultures(query);
        }}
        onImport={(culture) => {
          void handleImportPublicCulture(culture);
        }}
      />

      <Dialog
        open={Boolean(deleteDialogCulture)}
        onClose={() => setDeleteDialogCulture(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ pb: 1 }}>
          {t('deleteDialog.title')}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography color="text.secondary">
            {t('deleteDialog.confirmation', { name: deleteDialogCulture?.name ?? '' })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button variant="outlined" onClick={() => setDeleteDialogCulture(null)}>
            {t('common:actions.cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
            {t('buttons.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {showForm ? (
        <CultureForm
          culture={editingCulture}
          onSave={handleSave}
          onCancel={handleCancel}
          onViewPublicLibraryMatch={(match) => void handleViewPublicLibraryMatch(match)}
        />
      ) : null}

      <CulturesImportStartDialog
        open={importStartDialogOpen}
        onClose={() => setImportStartDialogOpen(false)}
        onFileSelected={(file) => void handleImportFileSelected(file)}
        t={t}
      />

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

      <CulturesExportDialog
        open={exportDialogOpen}
        hasCurrentCulture={Boolean(selectedCulture)}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
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
          <Button variant="outlined" onClick={() => setEnrichAllConfirmOpen(false)}>{t('buttons.aiClose')}</Button>
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
          <Button variant="outlined" onClick={() => setEnrichmentDialogOpen(false)}>{t('buttons.aiClose')}</Button>
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
                {t('history.emptyState.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('history.emptyState.description')}
              </Typography>
            </Box>
          ) : (
            <List>
              {historyItems.map((item, index) => {
                const isCurrentVersion = isCurrentHistoryEntry(item, index);
                const isCultureHistory = historyScope === 'culture';
                const historyTarget = getHistoryEntryTarget(item);
                const mobileTitle = getHistoryEntryTitle(item, t);
                const mobileMeta = getHistoryEntryMeta(item, t, fallbackHistoryActorLabel);
                const changes = item.changes ?? [];
                const changeList = changes.length > 0 ? (
                  <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {t('history.changedFields')}
                    </Typography>
                    <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2 }}>
                      {changes.map((change) => (
                        <Typography
                          key={`${item.history_id}-${change.field}`}
                          component="li"
                          variant="caption"
                          color="text.secondary"
                          sx={{ lineHeight: 1.35 }}
                        >
                          <Typography component="span" variant="caption" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            {getHistoryChangeFieldLabel(change, t)}
                          </Typography>
                          {': '}
                          {change.field === 'created'
                            ? formatHistoryChangeValue(change.new_value, change.field, t)
                            : `${formatHistoryChangeValue(change.old_value, change.field, t)} → ${formatHistoryChangeValue(change.new_value, change.field, t)}`}
                        </Typography>
                      ))}
                    </Stack>
                  </Stack>
                ) : null;
                return (
                  <ListItem key={item.history_id} disableGutters sx={{ mb: isMobile ? 1 : 0 }}>
                    {isMobile ? (
                      <Paper variant="outlined" sx={{ width: '100%', p: 1.25, borderRadius: 1.5 }}>
                        <Stack spacing={1}>
                          {!isCultureHistory ? (
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
                                  {t('history.objectTypes.openTarget')}
                                </Link>
                              ) : null}
                            </Box>
                          ) : null}
                          {!isCultureHistory ? (
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
                          ) : null}
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
                          {isCultureHistory ? changeList : null}
                          <Divider />
                          {isCurrentVersion ? (
                            <Chip
                              label={t('history.currentVersion')}
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ alignSelf: 'flex-start' }}
                            />
                          ) : (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleRestoreVersion(item.history_id)}
                              sx={{ alignSelf: 'flex-start', minHeight: 34 }}
                            >
                              {t('history.restoreButton')}
                            </Button>
                          )}
                        </Stack>
                      </Paper>
                    ) : (
                      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ width: '100%' }}>
                        <ListItemText
                          sx={{ mr: 1 }}
                          disableTypography
                          primary={!isCultureHistory ? (
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                              {mobileTitle}
                              {historyTarget ? (
                                <>
                                  {' · '}
                                  <Link component={RouterLink} to={historyTarget} underline="hover" onClick={() => setHistoryOpen(false)}>
                                    {item.object_type === 'culture' ? t('history.objectTypes.culture') : t('history.objectTypes.plantingPlan')}
                                  </Link>
                                </>
                              ) : null}
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {mobileMeta}
                            </Typography>
                          )}
                          secondary={isCultureHistory ? changeList : (
                            <Typography variant="caption" color="text.secondary">
                              {mobileMeta}
                            </Typography>
                          )}
                        />
                        {isCurrentVersion ? (
                          <Chip
                            label={t('history.currentVersion')}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        ) : (
                          <Button onClick={() => handleRestoreVersion(item.history_id)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {t('history.restoreButton')}
                          </Button>
                        )}
                      </Stack>
                    )}
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setHistoryOpen(false)}>{t('history.closeButton')}</Button>
        </DialogActions>
      </Dialog>



      <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('shortcuts.title')}</DialogTitle>
        <DialogContent>
          <List dense>
            <ListItem>
              <ListItemText primary={t('shortcuts.openShortcuts')} secondary="?" />
            </ListItem>
            <ListItem>
              <ListItemText primary={t('shortcuts.commandPalette')} secondary="Ctrl+K" />
            </ListItem>
            <ListItem>
              <ListItemText primary={t('shortcuts.closeDialog')} secondary="Esc" />
            </ListItem>
            {aiEnrichmentEnabled && (
              <>
                <ListItem>
                  <ListItemText primary={t('shortcuts.aiComplete')} secondary="–" />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('shortcuts.aiReresearch')} secondary="–" />
                </ListItem>
                <ListItem>
                  <ListItemText primary={t('shortcuts.aiCompleteAll')} secondary="–" />
                </ListItem>
              </>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShortcutsOpen(false)}>{t('history.closeButton')}</Button>
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
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      {pendingCultureDeletions.map((deletion, index) => (
        <DeleteUndoSnackbar
          key={deletion.id}
          open={deletion.visible}
          message={t('messages.deleted')}
          undoLabel={t('common:actions.undo')}
          offsetIndex={index}
          testId="culture-delete-snackbar"
          onClose={() => closePendingCultureDeletionSnackbar(deletion.id)}
          onUndo={() => undoPendingCultureDeletion(deletion.id)}
        />
      ))}
    </PageContainer>
  );
}
export default Cultures;
