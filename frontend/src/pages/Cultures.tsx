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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { cultureAPI, type Culture, type EnrichmentResult } from '../api/api';
import type { CultivationType } from '../api/types';
import { CultureDetail } from '../cultures/CultureDetail';
import { CultureForm } from '../cultures/CultureForm';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Tooltip,
  Typography,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import {
  buildAllCulturesExport,
  buildAllCulturesFilename,
  buildSingleCultureExport,
  buildSingleCultureFilename,
  downloadJsonFile,
} from '../cultures/exportUtils';
import { useCommandContextTag, useRegisterCommands } from '../commands/CommandProvider';
import type { CommandSpec } from '../commands/types';
import { isTypingInEditableElement } from '../hooks/useKeyboardShortcuts';
import { extractApiErrorMessage, isApiRequestCanceled } from '../api/errors';
import { normalizeCultivationType, normalizeHarvestMethod, normalizeNutrientDemand, normalizeSeedingRequirementType, normalizeSeedRateUnit } from '../cultures/enumNormalization';
import {
  SELECTED_CULTURE_STORAGE_KEY,
  buildImportSuccessMessage,
  getStoredCultureId,
  mapImportErrors,
  parseCultureId,
  type ImportFailedEntry,
  type ImportPreviewResult,
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

const ENRICHMENT_LOADING_STEPS = [
  { key: 'request', startSeconds: 0 },
  { key: 'research', startSeconds: 12 },
  { key: 'validation', startSeconds: 32 },
  { key: 'results', startSeconds: 52 },
] as const;
const ENRICHMENT_EXPECTED_SECONDS = 75;
function Cultures(): React.ReactElement {
  const { t } = useTranslation('cultures');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCultureParam = searchParams.get('cultureId');
  const selectedCultureIdFromQuery = parseCultureId(selectedCultureParam);

  const [cultures, setCultures] = useState<Culture[]>([]);
  const selectionSyncSourceRef = useRef<'internal' | 'query' | null>(null);
  const [selectedCultureId, setSelectedCultureId] = useState<number | undefined>(() => {
    if (Number.isFinite(selectedCultureIdFromQuery)) {
      return selectedCultureIdFromQuery;
    }

    return getStoredCultureId();
  });
  const [showForm, setShowForm] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | undefined>(undefined);
  const [importMenuAnchor, setImportMenuAnchor] = useState<null | HTMLElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreviewCount, setImportPreviewCount] = useState(0);
  const [importValidCount, setImportValidCount] = useState(0);
  const [importInvalidEntries, setImportInvalidEntries] = useState<string[]>([]);
  const [importPayload, setImportPayload] = useState<Record<string, unknown>[]>([]);
  const [importPreviewResults, setImportPreviewResults] = useState<ImportPreviewResult[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'ready' | 'uploading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importFailedEntries, setImportFailedEntries] = useState<ImportFailedEntry[]>([]);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [confirmUpdates, setConfirmUpdates] = useState(false);
  const [deleteDialogCulture, setDeleteDialogCulture] = useState<Culture | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<Array<{ history_id: number; history_date: string; summary: string; culture_id?: number }>>([]);
  const [historyScope, setHistoryScope] = useState<'culture' | 'global' | 'project'>('culture');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aiMenuAnchor, setAiMenuAnchor] = useState<null | HTMLElement>(null);
  const [enrichmentDialogOpen, setEnrichmentDialogOpen] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);
  const [selectedSuggestionFields, setSelectedSuggestionFields] = useState<string[]>([]);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentLoadingStartedAt, setEnrichmentLoadingStartedAt] = useState<number | null>(null);
  const [enrichmentLoadingNow, setEnrichmentLoadingNow] = useState<number>(Date.now());
  const [enrichmentCostBanner, setEnrichmentCostBanner] = useState<string | null>(null);
  const [enrichAllConfirmOpen, setEnrichAllConfirmOpen] = useState(false);
  const enrichmentLoadingRef = useRef(false);
  const enrichmentAbortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info') => {
    setSnackbar({ open: true, message, severity });
  }, []);



  useEffect(() => {
    enrichmentLoadingRef.current = enrichmentLoading;
  }, [enrichmentLoading]);

  useEffect(() => {
    if (!enrichmentLoading) {
      setEnrichmentLoadingStartedAt(null);
      return;
    }

    const startedAt = Date.now();
    setEnrichmentLoadingStartedAt(startedAt);
    setEnrichmentLoadingNow(startedAt);
    const intervalId = window.setInterval(() => setEnrichmentLoadingNow(Date.now()), 500);
    return () => window.clearInterval(intervalId);
  }, [enrichmentLoading]);

  const updateSelectedCultureId = useCallback((id: number | undefined, source: 'internal' | 'query') => {
    selectionSyncSourceRef.current = source;
    setSelectedCultureId((currentId) => (currentId === id ? currentId : id));
  }, []);

  const fetchCultures = useCallback(async () => {
    try {
      const response = await cultureAPI.list();
      setCultures(response.data.results);
    } catch (error) {
      console.error('Error fetching cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    }
  }, [showSnackbar, t]);

  // Fetch cultures on mount
  useEffect(() => {
    // eslint-disable-next-line -- Data fetching on mount is intentional
    fetchCultures();
  }, [fetchCultures]);

  useEffect(() => {
    if (selectionSyncSourceRef.current === 'internal') {
      return;
    }

    if (selectedCultureParam === null) {
      return;
    }

    const nextCultureId = selectedCultureIdFromQuery;

    if (nextCultureId !== selectedCultureId) {
      updateSelectedCultureId(nextCultureId, 'query');
    }
  }, [selectedCultureIdFromQuery, selectedCultureId, updateSelectedCultureId]);

  useEffect(() => {
    if (selectedCultureId === undefined) {
      localStorage.removeItem(SELECTED_CULTURE_STORAGE_KEY);

      if (selectionSyncSourceRef.current === 'query') {
        selectionSyncSourceRef.current = null;
        return;
      }

      if (!selectedCultureParam) {
        selectionSyncSourceRef.current = null;
        return;
      }

      setSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete('cultureId');
        return nextParams;
      }, { replace: true });
      selectionSyncSourceRef.current = null;
      return;
    }

    localStorage.setItem(SELECTED_CULTURE_STORAGE_KEY, String(selectedCultureId));

    if (selectionSyncSourceRef.current === 'query') {
      selectionSyncSourceRef.current = null;
      return;
    }

    if (selectedCultureParam === String(selectedCultureId)) {
      selectionSyncSourceRef.current = null;
      return;
    }

    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set('cultureId', String(selectedCultureId));
      return nextParams;
    }, { replace: true });
    selectionSyncSourceRef.current = null;
  }, [selectedCultureId, selectedCultureParam, setSearchParams]);

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
      // Transform culture data for API: replace supplier object with supplier_id
      const normalizedSeedPackages = Array.isArray(culture.seed_packages)
        ? culture.seed_packages.map((pkg) => ({
            size_value: Math.round((Number(pkg.size_value) || 0) * 10) / 10,
            size_unit: 'g' as const,
            evidence_text: pkg.evidence_text ?? '',
            last_seen_at: pkg.last_seen_at ?? null,
          }))
        : culture.seed_packages;

      const dataToSend = {
        ...culture,
        seed_packages: normalizedSeedPackages,
        seed_rate_unit: normalizeSeedRateUnit(culture.seed_rate_unit),
        harvest_method: normalizeHarvestMethod(culture.harvest_method),
        nutrient_demand: normalizeNutrientDemand(culture.nutrient_demand),
        cultivation_type: normalizeCultivationType(culture.cultivation_type),
        cultivation_types: (culture.cultivation_types && culture.cultivation_types.length > 0)
          ? culture.cultivation_types
          : (culture.cultivation_type ? [normalizeCultivationType(culture.cultivation_type)] : ['pre_cultivation']),
        seed_rate_by_cultivation: culture.seed_rate_by_cultivation ?? null,
        seeding_requirement_type: normalizeSeedingRequirementType(culture.seeding_requirement_type),
        supplier_id: culture.supplier?.id || null,
        supplier_name: culture.supplier && !culture.supplier.id ? culture.supplier.name : undefined,
        supplier: undefined, // Remove supplier object from payload
      };

      delete (dataToSend as Partial<Culture> & Record<string, unknown>).distance_within_row_m;
      delete (dataToSend as Partial<Culture> & Record<string, unknown>).row_spacing_m;
      delete (dataToSend as Partial<Culture> & Record<string, unknown>).sowing_depth_m;

      let savedCulture: Culture;
      if (editingCulture) {
        const response = await cultureAPI.update(editingCulture.id!, dataToSend as Culture);
        savedCulture = response.data;
        showSnackbar(t('messages.updateSuccess'), 'success');
      } else {
        const response = await cultureAPI.create(dataToSend as Culture);
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
      showSnackbar(
        editingCulture ? t('messages.updateError') : t('messages.createError'),
        'error'
      );
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
      navigate(`/planting-plans?cultureId=${selectedCultureId}`);
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

  const resetImportState = () => {
    setImportPreviewCount(0);
    setImportValidCount(0);
    setImportInvalidEntries([]);
    setImportPayload([]);
    setImportStatus('idle');
    setImportError(null);
    setImportSuccess(null);
    setImportPreviewResults([]);
    setImportFailedEntries([]);
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
        setImportStatus('error');
        setImportError(t(importAnalysis.errorKey));
        setImportPreviewCount(importAnalysis.originalCount);
        setImportValidCount(0);
        setImportInvalidEntries(importAnalysis.invalidEntries);
        setImportDialogOpen(true);
        return;
      }

      setImportStatus('uploading');
      try {
        const response = await cultureAPI.importPreview(importAnalysis.validEntries);

        setImportPreviewCount(importAnalysis.originalCount);
        setImportValidCount(importAnalysis.validEntries.length);
        setImportInvalidEntries(importAnalysis.invalidEntries);
        setImportPayload(importAnalysis.validEntries);
        setImportPreviewResults(response.data.results);
        setImportStatus('ready');
        setImportDialogOpen(true);
      } catch (error) {
        console.error('Error calling preview endpoint:', error);
        setImportStatus('error');
        setImportError(t('import.errors.network'));
        setImportDialogOpen(true);
      }
    } catch (error) {
      console.error('Error reading JSON file:', error);
      setImportStatus('error');
      setImportError(t('import.errors.parse'));
      setImportDialogOpen(true);
    }
  };

  const handleImportStart = async () => {
    if (importPayload.length === 0 || importStatus === 'uploading') {
      return;
    }

    setImportStatus('uploading');
    setImportError(null);
    setImportSuccess(null);
    setImportFailedEntries([]);

    try {
      const response = await cultureAPI.importApply({
        items: importPayload,
        confirm_updates: confirmUpdates,
      });

      const { created_count, updated_count, skipped_count, errors } = response.data;
      
      if (errors.length > 0) {
        setImportFailedEntries(mapImportErrors(errors, importPayload));
        setImportError(t('import.errors.someFailures', {
          failed: errors.length,
        }));
        setImportStatus('error');
        return;
      }

      const successMessage = buildImportSuccessMessage(created_count, updated_count, skipped_count, t);

      setImportStatus('success');
      setImportSuccess(successMessage || t('import.success'));
      await fetchCultures();
    } catch (error) {
      console.error('Error importing cultures:', error);
      setImportStatus('error');
      setImportError(t('import.errors.network'));
    }
  };

  const handleImportDialogClose = () => {
    setImportDialogOpen(false);
  };

  const selectedCulture = cultures.find(c => c.id === selectedCultureId);
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

  const canRunEnrichmentForCulture = useCallback((culture?: Culture | null): boolean => {
    return Boolean(culture?.supplier && (culture.supplier.allowed_domains || []).length > 0);
  }, []);

  const enrichmentDisabledReason = 'Für KI-Recherche muss ein Lieferant mit erlaubten Domains konfiguriert sein.';

  const commandSpecs = useMemo<CommandSpec[]>(() => {
    return [
      {
        id: 'culture.edit',
        title: 'Kultur bearbeiten (Alt+E)',
        keywords: ['kultur', 'bearbeiten', 'edit'],
        shortcutHint: 'Alt+E',
        keys: { alt: true, key: 'e' },
        contextTags: ['cultures'],
        isAvailable: () => Boolean(selectedCulture),
        run: () => { if (selectedCulture) { handleEdit(selectedCulture); } },
      },
      {
        id: 'culture.delete',
        title: 'Kultur löschen (Alt+Shift+D)',
        keywords: ['kultur', 'löschen', 'delete'],
        shortcutHint: 'Alt+Shift+D',
        keys: { alt: true, shift: true, key: 'd' },
        contextTags: ['cultures'],
        isAvailable: () => Boolean(selectedCulture),
        run: () => { if (selectedCulture) { handleDelete(selectedCulture); } },
      },
      {
        id: 'culture.exportCurrent',
        title: 'JSON exportieren (Alt+J)',
        keywords: ['json', 'export', 'kultur'],
        shortcutHint: 'Alt+J',
        keys: { alt: true, key: 'j' },
        contextTags: ['cultures'],
        isAvailable: () => Boolean(selectedCulture),
        run: handleExportCurrentCulture,
      },
      {
        id: 'culture.exportAll',
        title: 'Alle Kulturen exportieren (Alt+Shift+J)',
        keywords: ['json', 'export', 'alle', 'kulturen'],
        shortcutHint: 'Alt+Shift+J',
        keys: { alt: true, shift: true, key: 'j' },
        contextTags: ['cultures'],
        isAvailable: () => true,
        run: handleExportAllCultures,
      },
      {
        id: 'culture.import',
        title: 'JSON importieren (Alt+I)',
        keywords: ['json', 'import'],
        shortcutHint: 'Alt+I',
        keys: { alt: true, key: 'i' },
        contextTags: ['cultures'],
        isAvailable: () => true,
        run: handleImportFileTrigger,
      },
      {
        id: 'culture.createPlan',
        title: 'Anbauplan erstellen (Alt+P)',
        keywords: ['anbauplan', 'planting', 'plan'],
        shortcutHint: 'Alt+P',
        keys: { alt: true, key: 'p' },
        contextTags: ['cultures'],
        isAvailable: () => Boolean(selectedCultureId),
        run: handleCreatePlantingPlan,
      },

      {
        id: 'culture.aiCompleteCurrent',
        title: 'Kultur per KI vervollständigen (Alt+U)',
        keywords: ['ki', 'ai', 'vervollständigen', 'complete', 'kultur'],
        shortcutHint: 'Alt+U',
        keys: { alt: true, key: 'u' },
        contextTags: ['cultures'],
        isAvailable: () => Boolean(selectedCulture) && canRunEnrichmentForCulture(selectedCulture) && !enrichmentLoading,
        run: () => { void handleEnrichCurrent('complete'); },
      },
      {
        id: 'culture.aiReresearchCurrent',
        title: 'Kultur per KI neu recherchieren (Alt+R)',
        keywords: ['ki', 'ai', 'recherche', 'reresearch', 'kultur'],
        shortcutHint: 'Alt+R',
        keys: { alt: true, key: 'r' },
        contextTags: ['cultures'],
        isAvailable: () => Boolean(selectedCulture) && canRunEnrichmentForCulture(selectedCulture) && !enrichmentLoading,
        run: () => { void handleEnrichCurrent('reresearch'); },
      },
      {
        id: 'culture.aiCompleteAll',
        title: 'Alle Kulturen per KI vervollständigen (Alt+A)',
        keywords: ['ki', 'ai', 'alle', 'kulturen', 'vervollständigen'],
        shortcutHint: 'Alt+A',
        keys: { alt: true, key: 'a' },
        contextTags: ['cultures'],
        isAvailable: () => cultures.some((culture) => canRunEnrichmentForCulture(culture)) && !enrichmentLoading,
        run: () => setEnrichAllConfirmOpen(true),
      },
      {
        id: 'culture.previous',
        title: 'Vorherige Kultur (Alt+Shift+←)',
        keywords: ['vorherige', 'kultur', 'left'],
        shortcutHint: 'Alt+Shift+←',
        keys: { alt: true, shift: true, key: 'ArrowLeft' },
        contextTags: ['cultures'],
        isAvailable: () => cultures.length > 1 && Boolean(selectedCultureId),
        run: () => goToRelativeCulture('previous'),
      },
      {
        id: 'culture.next',
        title: 'Nächste Kultur (Alt+Shift+→)',
        keywords: ['nächste', 'kultur', 'right'],
        shortcutHint: 'Alt+Shift+→',
        keys: { alt: true, shift: true, key: 'ArrowRight' },
        contextTags: ['cultures'],
        isAvailable: () => cultures.length > 1 && Boolean(selectedCultureId),
        run: () => goToRelativeCulture('next'),
      },
    ];
  }, [canRunEnrichmentForCulture, cultures, cultures.length, enrichmentLoading, goToRelativeCulture, handleCreatePlantingPlan, handleExportAllCultures, handleExportCurrentCulture, handleImportFileTrigger, selectedCulture, selectedCultureId]);

  useRegisterCommands('cultures-page', commandSpecs);

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


  const cultureHasMissingEnrichmentFields = useCallback((culture: Culture): boolean => {
    const isMissing = (value: unknown): boolean => {
      if (value === null || value === undefined) return true;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === 'string') return value.trim().length === 0;
      return false;
    };

    return [
      culture.growth_duration_days,
      culture.harvest_duration_days,
      culture.propagation_duration_days,
      culture.harvest_method,
      culture.expected_yield,
      culture.seed_packages,
      culture.distance_within_row_cm,
      culture.row_spacing_cm,
      culture.sowing_depth_cm,
      culture.seed_rate_value,
      culture.seed_rate_unit,
      culture.thousand_kernel_weight_g,
      culture.nutrient_demand,
      culture.cultivation_type,
      culture.notes,
    ].some(isMissing);
  }, []);

  const enrichableCultureIds = useMemo(
    () => cultures.filter((culture) => culture.id && canRunEnrichmentForCulture(culture) && cultureHasMissingEnrichmentFields(culture)).map((culture) => culture.id as number),
    [cultures, cultureHasMissingEnrichmentFields, canRunEnrichmentForCulture],
  );



  const selectedCultureNeedsCompletion = useMemo(
    () => (selectedCulture ? cultureHasMissingEnrichmentFields(selectedCulture) : false),
    [selectedCulture, cultureHasMissingEnrichmentFields],
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
        if (Number.isFinite(directValue) && directValue > 0 && directUnit && ['g_per_m2', 'g_per_lfm', 'seeds/m'].includes(directUnit)) {
          sanitizedByCultivation.direct_sowing = { value: directValue, unit: directUnit };
        }
        const preValue = Number(rawByCultivation.pre_cultivation?.value);
        const preUnit = normalizeSeedRateUnit(rawByCultivation.pre_cultivation?.unit);
        if (Number.isFinite(preValue) && preValue > 0 && preUnit && ['g_per_m2', 'g_per_lfm', 'seeds/m'].includes(preUnit)) {
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
        if (Number.isFinite(transplantValue) && transplantValue > 0 && transplantUnit && ['g_per_m2', 'g_per_lfm', 'seeds/m'].includes(transplantUnit)) {
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
  }, [handleEnrichAll, handleEnrichCurrent, selectedCultureNeedsCompletion]);



  const enrichmentElapsedSeconds = enrichmentLoadingStartedAt
    ? Math.max(0, Math.floor((enrichmentLoadingNow - enrichmentLoadingStartedAt) / 1000))
    : 0;
  const enrichmentProgressPercent = Math.min(95, Math.round((enrichmentElapsedSeconds / ENRICHMENT_EXPECTED_SECONDS) * 100));
  const enrichmentActiveStepIndex = ENRICHMENT_LOADING_STEPS.reduce((lastIndex, step, index) => (
    enrichmentElapsedSeconds >= step.startSeconds ? index : lastIndex
  ), 0);

  return (
    <div className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h1>{t('title')}</h1>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ButtonGroup variant="contained" aria-label={t('buttons.addNew')}>
            <Button startIcon={<AddIcon />} onClick={handleAddNew}>
              {t('buttons.addNew')}
            </Button>
            <Button
              size="small"
              aria-label={t('import.menuLabel')}
              aria-controls={importMenuAnchor ? 'culture-import-menu' : undefined}
              aria-haspopup="true"
              onClick={handleImportMenuOpen}
              sx={{ minWidth: 32, px: 0.5 }}
            >
              <ArrowDropDownIcon />
            </Button>
          </ButtonGroup>
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

      <Dialog open={importDialogOpen} onClose={handleImportDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>{t('import.title')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Summary */}
            <Typography variant="body1">
              {t('import.foundCount', { count: importValidCount || importPreviewCount })}
            </Typography>
            {importPreviewCount !== importValidCount && (
              <Typography variant="body2" color="warning.main">
                {t('import.invalidCount', {
                  invalid: importPreviewCount - importValidCount,
                })}
              </Typography>
            )}
            
            {/* Grouped results */}
            {importPreviewResults.length > 0 && (
              <>
                {/* New cultures */}
                {(() => {
                  const newCultures = importPreviewResults.filter(r => r.status === 'create');
                  return newCultures.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" color="success.main">
                        {t('import.newCultures')} ({newCultures.length})
                      </Typography>
                      <List dense>
                        {newCultures.map((result) => (
                          <ListItem key={result.index}>
                            <ListItemText 
                              primary={`${result.import_data.name}${result.import_data.variety ? ` (${result.import_data.variety})` : ''}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  );
                })()}
                
                {/* Update candidates */}
                {(() => {
                  const updateCandidates = importPreviewResults.filter(r => r.status === 'update_candidate');
                  return updateCandidates.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" color="warning.main">
                        {t('import.updateCandidates')} ({updateCandidates.length})
                      </Typography>
                      <List dense>
                        {updateCandidates.map((result) => (
                          <ListItem key={result.index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <ListItemText 
                              primary={`${result.import_data.name}${result.import_data.variety ? ` (${result.import_data.variety})` : ''}`}
                              secondary={result.diff && result.diff.length > 0 ? t('import.fieldsChanged', { count: result.diff.length }) : t('import.noChanges')}
                            />
                            {result.diff && result.diff.length > 0 && (
                              <Box sx={{ ml: 2, fontSize: '0.875rem' }}>
                                {result.diff.map((d, idx) => (
                                  <Typography key={idx} variant="caption" display="block">
                                    {d.field}: {JSON.stringify(d.current)} → {JSON.stringify(d.new)}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                          </ListItem>
                        ))}
                      </List>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <input
                          type="checkbox"
                          id="confirm-updates"
                          checked={confirmUpdates}
                          onChange={(e) => setConfirmUpdates(e.target.checked)}
                        />
                        <label htmlFor="confirm-updates">
                          <Typography variant="body2">{t('import.confirmUpdates')}</Typography>
                        </label>
                      </Box>
                    </Box>
                  );
                })()}
              </>
            )}
            
            {/* Invalid entries */}
            {importInvalidEntries.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" color="error.main">
                  {t('import.invalidEntries')} ({importInvalidEntries.length})
                </Typography>
                <List dense>
                  {importInvalidEntries.map((entry) => (
                    <ListItem key={entry}>
                      <ListItemText primary={entry} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            
            {/* Failed entries from import attempt */}
            {importFailedEntries.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" color="error.main">
                  {t('import.failedEntries')} ({importFailedEntries.length})
                </Typography>
                <List dense>
                  {importFailedEntries.map((entry, idx) => (
                    <ListItem key={idx}>
                      <ListItemText 
                        primary={entry.name ? `${entry.name}${entry.variety ? ` (${entry.variety})` : ''}` : `${t('import.invalidEntry')} ${entry.index + 1}`}
                        secondary={typeof entry.error === 'string' ? entry.error : JSON.stringify(entry.error)}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            
            {importError && <Alert severity="error">{importError}</Alert>}
            {importSuccess && <Alert severity="success">{importSuccess}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleImportDialogClose}>{t('import.close')}</Button>
          <Button
            variant="contained"
            onClick={handleImportStart}
            disabled={importValidCount === 0 || importStatus === 'uploading' || importStatus === 'success'}
          >
            {importStatus === 'success' ? t('import.done') : t('import.start')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={enrichAllConfirmOpen} onClose={() => setEnrichAllConfirmOpen(false)} maxWidth="xs" fullWidth>
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
      </Dialog>

      <Dialog open={enrichmentLoading} aria-labelledby="enrichment-loading-title" maxWidth="xs" fullWidth>
        <DialogTitle id="enrichment-loading-title">{t('ai.loadingTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, mb: 1 }}>
            <CircularProgress size={22} />
            <Typography>{t('ai.loadingText')}</Typography>
          </Box>
          <LinearProgress variant="determinate" value={enrichmentProgressPercent} sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {t('ai.loadingElapsed', { seconds: enrichmentElapsedSeconds, percent: enrichmentProgressPercent })}
          </Typography>
          <List dense sx={{ mt: 1 }}>
            {ENRICHMENT_LOADING_STEPS.map((step, index) => {
              const isDone = enrichmentElapsedSeconds >= step.startSeconds && index < enrichmentActiveStepIndex;
              const isActive = index === enrichmentActiveStepIndex;
              const Icon = isDone ? CheckCircleOutlineIcon : isActive ? AutorenewIcon : RadioButtonUncheckedIcon;
              return (
                <ListItem key={step.key} sx={{ px: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon fontSize="small" color={isDone ? 'success' : isActive ? 'primary' : 'disabled'} />
                    <Typography variant="body2" color={isActive ? 'text.primary' : 'text.secondary'}>
                      {t(`ai.loadingSteps.${step.key}`)}
                    </Typography>
                  </Box>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
      </Dialog>

      <Dialog open={enrichmentDialogOpen} onClose={() => setEnrichmentDialogOpen(false)} maxWidth="md" fullWidth>
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
      </Dialog>

      {/* Snackbar for notifications */}

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="sm"> 
        <DialogTitle>{historyScope === "project" ? "Projekt-Snapshots" : historyScope === "global" ? "Globaler Kultur-Verlauf" : "Versionen"}</DialogTitle>
        <DialogContent>
          <List>
            {historyItems.map((item) => (
              <ListItem key={item.history_id} secondaryAction={
                <Button onClick={() => handleRestoreVersion(item.history_id)}>Restore this version</Button>
              }>
                <ListItemText
                  primary={new Date(item.history_date).toLocaleString()}
                  secondary={historyScope === 'culture' ? item.summary : `${item.summary}${item.culture_id ? ` (Kultur #${item.culture_id})` : ''}`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
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
            <ListItem>
              <ListItemText primary="KI: Kultur vervollständigen" secondary="Alt+U" />
            </ListItem>
            <ListItem>
              <ListItemText primary="KI: Kultur neu recherchieren" secondary="Alt+R" />
            </ListItem>
            <ListItem>
              <ListItemText primary="KI: Alle Kulturen vervollständigen" secondary="Alt+A" />
            </ListItem>
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
