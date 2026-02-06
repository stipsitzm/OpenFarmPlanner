/**
 * Cultures (Kulturen) page component.
 * 
 * Displays crop culture details with searchable dropdown.
 * Includes create and edit functionality for cultures.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { cultureAPI, type Culture } from '../api/api';
import { CultureDetail } from '../components/CultureDetail';
import { CultureForm } from '../components/CultureForm';
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
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AgricultureIcon from '@mui/icons-material/Agriculture';

function Cultures(): React.ReactElement {
  const { t } = useTranslation('cultures');
  const navigate = useNavigate();
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [selectedCultureId, setSelectedCultureId] = useState<number | undefined>(undefined);
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
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
  const [confirmUpdates, setConfirmUpdates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch cultures on mount
  useEffect(() => {
    fetchCultures();
  }, []);

  const fetchCultures = async () => {
    try {
      const response = await cultureAPI.list();
      setCultures(response.data.results);
    } catch (error) {
      console.error('Error fetching cultures:', error);
      showSnackbar(t('messages.fetchError'), 'error');
    }
  };

  const handleCultureSelect = (culture: Culture | null) => {
    setSelectedCultureId(culture?.id);
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
          setSelectedCultureId(undefined);
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
        setSelectedCultureId(savedCulture.id);
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

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
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
          const cleanedJson = jsonString.replace(/,\s*([\}\]])/g, '$1');
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

    try {
      const response = await cultureAPI.importApply({
        items: importPayload,
        confirm_updates: confirmUpdates,
      });

      const { created_count, updated_count, skipped_count, errors } = response.data;
      
      if (errors.length > 0) {
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
                        Neue Kulturen ({newCultures.length})
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
                        Überschreiben möglich ({updateCandidates.length})
                      </Typography>
                      <List dense>
                        {updateCandidates.map((result) => (
                          <ListItem key={result.index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                            <ListItemText 
                              primary={`${result.import_data.name}${result.import_data.variety ? ` (${result.import_data.variety})` : ''}`}
                              secondary={result.diff && result.diff.length > 0 ? `${result.diff.length} Felder ändern` : 'Keine Änderungen'}
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
                          <Typography variant="body2">Überschreiben bestätigen</Typography>
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
                  Ungültige Einträge ({importInvalidEntries.length})
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
            {importStatus === 'success' ? 'Fertig' : 'Importieren'}
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
