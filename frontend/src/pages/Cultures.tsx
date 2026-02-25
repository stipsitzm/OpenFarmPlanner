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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import {
  buildAllCulturesExport,
  buildAllCulturesFilename,
  buildSingleCultureExport,
  buildSingleCultureFilename,
  downloadJsonFile,
} from '../cultures/exportUtils';
import { parseCultureImportJson } from '../cultures/importUtils';
import { useCommandContextTag, useRegisterCommands } from '../commands/CommandProvider';
import type { CommandSpec } from '../commands/types';

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
  const [deleteDialogCulture, setDeleteDialogCulture] = useState<Culture | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<Array<{ history_id: number; history_date: string; summary: string }>>([]);
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

  const handleDelete = (culture: Culture) => {
    setDeleteDialogCulture(culture);
  };

  const handleOpenHistory = async () => {
    if (!selectedCulture?.id) {
      return;
    }
    const response = await cultureAPI.history(selectedCulture.id);
    setHistoryItems(response.data);
    setHistoryOpen(true);
  };

  const handleRestoreVersion = async (historyId: number) => {
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
      showSnackbar(t('messages.updateError'), 'error');
    }
  };

  const handleSave = async (culture: Culture) => {
    try {
      // Transform culture data for API: replace supplier object with supplier_id
      const dataToSend = {
        ...culture,
        supplier_id: culture.supplier?.id || null,
        supplier: undefined, // Remove supplier object from payload
      };

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
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const jsonString = reader.result as string;
        const { entries, originalCount } = parseCultureImportJson(jsonString);

        if (originalCount === 0) {
          setImportStatus('error');
          setImportError(t('import.errors.notArray'));
          setImportDialogOpen(true);
          return;
        }

        const invalidEntries: string[] = [];
        const validEntries: Record<string, unknown>[] = [];

        entries.forEach((entry, index) => {
          const nameValue = (entry as { name?: unknown }).name;
          if (typeof nameValue === 'string' && nameValue.trim().length > 0) {
            validEntries.push(entry as Record<string, unknown>);
          } else {
            invalidEntries.push(`${t('import.invalidEntry')} ${index + 1}`);
          }
        });

        if (validEntries.length === 0) {
          setImportStatus('error');
          setImportError(t('import.errors.noValidEntries'));
          setImportPreviewCount(originalCount);
          setImportValidCount(0);
          setImportInvalidEntries(invalidEntries);
          setImportDialogOpen(true);
          return;
        }

        // Call preview endpoint
        setImportStatus('uploading');
        try {
          const response = await cultureAPI.importPreview(validEntries);
          
          setImportPreviewCount(originalCount);
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
  }, [cultures.length, goToRelativeCulture, handleCreatePlantingPlan, handleExportAllCultures, handleExportCurrentCulture, handleImportFileTrigger, selectedCulture, selectedCultureId]);

  useRegisterCommands('cultures-page', commandSpecs);

  return (
    <div className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h1>{t('title')}</h1>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
          <Button variant="outlined" onClick={handleOpenHistory} disabled={!selectedCulture}>
            Version history…
          </Button>
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
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <CultureDetail
          cultures={cultures}
          selectedCultureId={selectedCultureId}
          onCultureSelect={handleCultureSelect}
        />
      </Box>

      {/* Action buttons for selected culture */}
      {selectedCulture && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
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
            <Button
              aria-label="Anbauplan erstellen (Alt+P)"
              variant="contained"
              startIcon={<AgricultureIcon />}
              onClick={handleCreatePlantingPlan}
            >
              {t('buttons.createPlantingPlan')}
            </Button>
          </Tooltip>
          <Tooltip title="Kultur bearbeiten (Alt+E)">
            <Button
              aria-label="Kultur bearbeiten (Alt+E)"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => handleEdit(selectedCulture)}
            >
              {t('buttons.edit')}
            </Button>
          </Tooltip>
          <Tooltip title="Kultur löschen (Alt+Shift+D)">
            <Button
              aria-label="Kultur löschen (Alt+Shift+D)"
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => handleDelete(selectedCulture)}
            >
              {t('buttons.delete')}
            </Button>
          </Tooltip>
        </Box>
      )}

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

      {/* Snackbar for notifications */}

      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} fullWidth maxWidth="sm"> 
        <DialogTitle>Versionen</DialogTitle>
        <DialogContent>
          <List>
            {historyItems.map((item) => (
              <ListItem key={item.history_id} secondaryAction={
                <Button onClick={() => handleRestoreVersion(item.history_id)}>Restore this version</Button>
              }>
                <ListItemText
                  primary={new Date(item.history_date).toLocaleString()}
                  secondary={item.summary}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
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
