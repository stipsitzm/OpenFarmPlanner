/**
 * Cultures (Kulturen) page component.
 * 
 * Displays crop culture details with searchable dropdown.
 * Includes create and edit functionality for cultures.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { cultureAPI, type Culture } from '../api/api';
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AgricultureIcon from '@mui/icons-material/Agriculture';

function Cultures(): React.ReactElement {
  const { t } = useTranslation('cultures');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCultureParam = searchParams.get('cultureId');
  const parseCultureId = (value: string | null): number | undefined => {
    if (!value) {
      return undefined;
    }

    const parsedId = Number.parseInt(value, 10);
    return Number.isFinite(parsedId) ? parsedId : undefined;
  };
  const selectedCultureIdFromQuery = parseCultureId(selectedCultureParam);

  const getStoredCultureId = (): number | undefined => parseCultureId(localStorage.getItem('selectedCultureId'));

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
  const [importPreviewResults, setImportPreviewResults] = useState<Array<{
    index: number;
    status: 'create' | 'update_candidate';
    matched_culture_id?: number;
    diff?: Array<{ field: string; current: unknown; new: unknown }>;
    import_data: Record<string, unknown>;
    error?: string;
  }>>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'ready' | 'uploading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importFailedEntries, setImportFailedEntries] = useState<Array<{
    index: number;
    name?: string;
    variety?: string;
    error: string | Record<string, unknown>;
  }>>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [confirmUpdates, setConfirmUpdates] = useState(false);
  const [enrichLoadingMode, setEnrichLoadingMode] = useState<'overwrite' | 'fill_missing' | null>(null);
  const [enrichElapsedSeconds, setEnrichElapsedSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

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
      localStorage.removeItem('selectedCultureId');

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

    localStorage.setItem('selectedCultureId', String(selectedCultureId));

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

  const handleDelete = async (culture: Culture) => {
    if (window.confirm(t('buttons.deleteConfirm'))) {
      try {
        await cultureAPI.delete(culture.id!);
        await fetchCultures();
        if (selectedCultureId === culture.id) {
          updateSelectedCultureId(undefined, 'internal');
        }
        showSnackbar(t('messages.updateSuccess'), 'success');
      } catch (error) {
        console.error('Error deleting culture:', error);
        showSnackbar(t('messages.updateError'), 'error');
      }
    }
  };

  const handleSave = async (culture: Culture) => {
    try {
      let savedCulture: Culture;
      if (editingCulture) {
        const response = await cultureAPI.update(editingCulture.id!, culture);
        savedCulture = response.data;
        showSnackbar(t('messages.updateSuccess'), 'success');
      } else {
        const response = await cultureAPI.create(culture);
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

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const jsonString = reader.result as string;
        let parsed: unknown;
        
        // Try parsing first with standard JSON.parse
        try {
          parsed = JSON.parse(jsonString);
        } catch {
          // If parsing fails, try removing trailing commas before closing brackets/braces
          // This handles common JSON export formats that include trailing commas
          const cleanedJson = jsonString.replace(/,\s*([}\]])/g, '$1');
          parsed = JSON.parse(cleanedJson);
        }
        if (!Array.isArray(parsed)) {
          setImportStatus('error');
          setImportError(t('import.errors.notArray'));
          setImportDialogOpen(true);
          return;
        }

        const invalidEntries: string[] = [];
        const validEntries: Record<string, unknown>[] = [];

        parsed.forEach((entry, index) => {
          const isObject = typeof entry === 'object' && entry !== null;
          const nameValue = isObject ? (entry as { name?: unknown }).name : undefined;
          if (isObject && typeof nameValue === 'string' && nameValue.trim().length > 0) {
            validEntries.push(entry as Record<string, unknown>);
          } else {
            invalidEntries.push(`${t('import.invalidEntry')} ${index + 1}`);
          }
        });

        if (validEntries.length === 0) {
          setImportStatus('error');
          setImportError(t('import.errors.noValidEntries'));
          setImportPreviewCount(parsed.length);
          setImportValidCount(0);
          setImportInvalidEntries(invalidEntries);
          setImportDialogOpen(true);
          return;
        }

        // Call preview endpoint
        setImportStatus('uploading');
        try {
          const response = await cultureAPI.importPreview(validEntries);
          
          setImportPreviewCount(parsed.length);
          setImportValidCount(validEntries.length);
          setImportInvalidEntries(invalidEntries);
          setImportPayload(validEntries);
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
        console.error('Error parsing JSON file:', error);
        setImportStatus('error');
        setImportError(t('import.errors.parse'));
        setImportDialogOpen(true);
      }
    };

    reader.readAsText(file);
    event.target.value = '';
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
        // Map errors to include culture names from the original payload
        const detailedErrors = errors.map((err: { index: number; error: unknown }) => {
          const originalData = importPayload[err.index];
          return {
            index: err.index,
            name: originalData?.name as string | undefined,
            variety: originalData?.variety as string | undefined,
            error: typeof err.error === 'string' || typeof err.error === 'object' ? err.error as string | Record<string, unknown> : String(err.error),
          };
        });
        
        setImportFailedEntries(detailedErrors);
        setImportError(t('import.errors.someFailures', {
          failed: errors.length,
        }));
        setImportStatus('error');
        return;
      }

      let successMessage = '';
      if (created_count > 0) {
        successMessage += t('import.created', { count: created_count });
      }
      if (updated_count > 0) {
        if (successMessage) successMessage += ', ';
        successMessage += t('import.updated', { count: updated_count });
      }
      if (skipped_count > 0) {
        if (successMessage) successMessage += ', ';
        successMessage += t('import.skipped', { count: skipped_count });
      }

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


  const missingEnrichmentFields = selectedCulture
    ? ['name', 'variety', 'seed_supplier'].filter((field) => {
      const value = selectedCulture[field as keyof Culture];
      return typeof value !== 'string' || value.trim().length === 0;
    })
    : [];
  const canEnrichCulture = selectedCulture !== undefined && missingEnrichmentFields.length === 0;

  const fillMissingCandidateFields: Array<keyof Culture> = [
    'crop_family',
    'nutrient_demand',
    'cultivation_type',
    'growth_duration_days',
    'harvest_duration_days',
    'propagation_duration_days',
    'harvest_method',
    'expected_yield',
    'distance_within_row_cm',
    'row_spacing_cm',
    'sowing_depth_cm',
    'seed_rate_value',
    'seed_rate_unit',
    'sowing_calculation_safety_percent',
    'thousand_kernel_weight_g',
    'package_size_g',
    'notes',
  ];

  const fillMissingTargetCount = selectedCulture
    ? fillMissingCandidateFields.filter((field) => {
      const value = selectedCulture[field];
      if (value === null || value === undefined) return true;
      if (typeof value === 'string') return value.trim().length === 0;
      return false;
    }).length
    : 0;


  const getEnrichmentDisabledMessage = (mode: 'overwrite' | 'fill_missing'): string => {
    if (!selectedCulture) {
      return t('enrichment.messages.noCultureSelected');
    }

    if (missingEnrichmentFields.length > 0) {
      return t('enrichment.messages.missingRequiredFields', {
        fields: missingEnrichmentFields.join(', '),
      });
    }

    if (mode === 'fill_missing' && fillMissingTargetCount === 0) {
      return t('enrichment.messages.noFillMissingTargets');
    }

    return '';

  };

  useEffect(() => {
    if (!enrichLoadingMode) {
      setEnrichElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setEnrichElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 500);

    return () => {
      window.clearInterval(timer);
    };
  }, [enrichLoadingMode]);

  const enrichProgressStep = enrichElapsedSeconds < 4
    ? t('enrichment.progress.stepSearching')
    : enrichElapsedSeconds < 9
      ? t('enrichment.progress.stepAnalyzing')
      : t('enrichment.progress.stepFinalizing');

  const handleEnrichCulture = async (mode: 'overwrite' | 'fill_missing') => {
    if (!selectedCulture?.id || !canEnrichCulture) {
      console.debug('[enrich] skipped before request', {
        hasSelectedCulture: Boolean(selectedCulture?.id),
        canEnrichCulture,
        mode,
      });
      return;
    }
    if (mode === 'fill_missing' && fillMissingTargetCount === 0) {
      console.debug('[enrich] skipped: no fill_missing targets', {
        selectedCultureId: selectedCulture.id,
        fillMissingTargetCount,
        fillMissingCandidateFields,
      });
      showSnackbar(t('enrichment.messages.noFillMissingTargets'), 'error');
      return;
    }

    setEnrichLoadingMode(mode);
    const startedAt = Date.now();
    const enrichUrl = `/cultures/${selectedCulture.id}/enrich/?mode=${mode}`;
    console.groupCollapsed(`[enrich] start culture=${selectedCulture.id} mode=${mode}`);
    console.debug('[enrich] preflight', {
      url: enrichUrl,
      selectedCultureId: selectedCulture.id,
      missingEnrichmentFields,
      fillMissingTargetCount,
      fillMissingCandidateFields,
      notesLength: selectedCulture.notes?.length ?? 0,
    });
    try {
      const response = await cultureAPI.enrich(selectedCulture.id, mode);
      console.debug('[enrich] API response', {
        status: response.status,
        statusText: response.statusText,
        updated_fields: response.data.updated_fields,
        sources_count: response.data.sources?.length ?? 0,
        confidence_score: response.data.confidence_score,
        plausibility_warnings: response.data.plausibility_warnings,
        debug: response.data.debug,
        durationMs: Date.now() - startedAt,
      });
      console.debug('[enrich] refreshing cultures after enrich...');
      await fetchCultures();
      console.debug('[enrich] cultures refreshed');
      if (response.data.updated_fields.length === 0) {
        const debug = response.data.debug;
        const parsedKeys = Array.isArray(debug?.llm?.parsed_keys)
          ? debug.llm.parsed_keys
          : [];
        console.debug('[enrich] no-op diagnostics', {
          mode,
          target_fields: debug?.target_fields ?? [],
          llm_update_keys: debug?.llm_update_keys ?? [],
          llm_parsed_keys: parsedKeys,
          combined_sources_count: debug?.combined_sources_count ?? 0,
          notes_skipped_due_to_missing_sources: Boolean(debug?.notes_skipped_due_to_missing_sources),
        });
        const notesSkipped = Boolean(response.data.debug?.notes_skipped_due_to_missing_sources);
        showSnackbar(
          notesSkipped
            ? t('enrichment.messages.noChangesMissingSources')
            : t('enrichment.messages.noChangesWithCounts', {
              targetCount: response.data.debug?.target_fields?.length ?? 0,
              llmUpdateCount: response.data.debug?.llm_update_keys?.length ?? 0,
              sourceCount: response.data.debug?.combined_sources_count ?? 0,
            }),
          'success'
        );
      } else {
        showSnackbar(t('enrichment.messages.success'), 'success');
      }
    } catch (error) {
      console.error('[enrich] API error', error);

      let message = t('enrichment.messages.error');
      let snackbarSeverity: 'error' | 'success' = 'error';

      if (axios.isAxiosError(error)) {
        const responseData = (error.response?.data && typeof error.response.data === 'object')
          ? error.response.data as {
            message?: unknown;
            code?: unknown;
            detail?: unknown;
            missing_fields?: unknown;
          }
          : undefined;

        console.debug('[enrich] axios error details', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          code: error.code,
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
          responseHeaders: error.response?.headers,
          responseData,
          durationMs: Date.now() - startedAt,
        });

        if (responseData) {
          console.debug('[enrich] backend error payload fields', {
            backendCode: responseData.code,
            backendMessage: responseData.message,
            backendDetail: responseData.detail,
            missingFields: responseData.missing_fields,
          });
        }

        if (error.code === 'ECONNABORTED') {
          message = t('enrichment.messages.timeout');
        } else if (error.response?.status === 422 && responseData?.code === 'NO_ENRICHABLE_FIELDS') {
          message = t('enrichment.messages.noChanges');
          snackbarSeverity = 'success';
          console.debug('[enrich] interpreted 422 NO_ENRICHABLE_FIELDS as no-op enrichment result');
        } else if (typeof responseData?.message === 'string' && responseData.message.trim()) {
          message = responseData.message;
        }
      }

      showSnackbar(message, snackbarSeverity);
    } finally {
      console.groupEnd();
      setEnrichLoadingMode(null);
    }
  };

  return (
    <div className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h1>{t('title')}</h1>
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
        <Menu
          id="culture-import-menu"
          anchorEl={importMenuAnchor}
          open={Boolean(importMenuAnchor)}
          onClose={handleImportMenuClose}
        >
          <MenuItem onClick={handleImportFileTrigger}>
            {t('import.menuItem')}
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
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <CultureDetail
          cultures={cultures}
          selectedCultureId={selectedCultureId}
          onCultureSelect={handleCultureSelect}
        />
      </Box>

      {/* Action buttons for selected culture */}
      {selectedCulture && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AgricultureIcon />}
            onClick={handleCreatePlantingPlan}
          >
            {t('buttons.createPlantingPlan')}
          </Button>
          <Tooltip title={!canEnrichCulture ? getEnrichmentDisabledMessage('overwrite') : ''}>
            <span>
              <Button
                variant="outlined"
                onClick={() => handleEnrichCulture('overwrite')}
                disabled={!canEnrichCulture || enrichLoadingMode !== null}
              >
                {enrichLoadingMode === 'overwrite' ? t('enrichment.messages.loading') : t('enrichment.buttons.overwrite')}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={(!canEnrichCulture || fillMissingTargetCount === 0) ? getEnrichmentDisabledMessage('fill_missing') : ''}>
            <span>
              <Button
                variant="outlined"
                onClick={() => handleEnrichCulture('fill_missing')}
                disabled={!canEnrichCulture || fillMissingTargetCount === 0 || enrichLoadingMode !== null}
              >
                {enrichLoadingMode === 'fill_missing' ? t('enrichment.messages.loading') : t('enrichment.buttons.fillMissing')}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => handleEdit(selectedCulture)}
          >
            {t('buttons.edit')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleDelete(selectedCulture)}
          >
            {t('buttons.delete')}
          </Button>
        </Box>
      )}

      <Dialog
        open={enrichLoadingMode !== null}
        onClose={() => undefined}
        disableEscapeKeyDown
        aria-labelledby="enrichment-progress-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="enrichment-progress-title">{t('enrichment.progress.title')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
            <CircularProgress size={28} />
            <Box>
              <Typography variant="body1">{t('enrichment.progress.description')}</Typography>
              <Typography variant="body2" color="text.secondary">{enrichProgressStep}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('enrichment.progress.elapsed', { seconds: enrichElapsedSeconds })}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
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

      {/* Snackbar for notifications */}
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
