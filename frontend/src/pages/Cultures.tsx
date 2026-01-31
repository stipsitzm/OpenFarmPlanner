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
  const [importStatus, setImportStatus] = useState<'idle' | 'ready' | 'uploading' | 'success' | 'error'>('idle');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });
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
    navigate('/cultures/new');
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
  };

  const handleImportFileTrigger = () => {
    handleImportMenuClose();
    resetImportState();
    fileInputRef.current?.click();
  };

  const handleImportFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
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

        setImportPreviewCount(parsed.length);
        setImportValidCount(validEntries.length);
        setImportInvalidEntries(invalidEntries);
        setImportPayload(validEntries);
        setImportStatus('ready');
        setImportDialogOpen(true);
        if (validEntries.length === 0) {
          setImportStatus('error');
          setImportError(t('import.errors.noValidEntries'));
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
      const response = await fetch('/api/cultures/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importPayload),
      });

      let responseData: unknown = null;
      try {
        responseData = await response.json();
      } catch (error) {
        responseData = null;
      }

      if (!response.ok) {
        const message =
          (responseData as { message?: string })?.message ?? t('import.errors.server');
        const invalidEntries = (responseData as { invalidEntries?: unknown })?.invalidEntries;
        setImportError(message);
        if (Array.isArray(invalidEntries)) {
          setImportInvalidEntries(
            invalidEntries.map((entry, index) =>
              typeof entry === 'string'
                ? entry
                : `${t('import.invalidEntry')} ${index + 1}`
            )
          );
        }
        setImportStatus('error');
        return;
      }

      setImportStatus('success');
      setImportSuccess(t('import.success'));
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

      <Dialog open={importDialogOpen} onClose={handleImportDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{t('import.title')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
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
            {importInvalidEntries.length > 0 && (
              <List dense>
                {importInvalidEntries.map((entry) => (
                  <ListItem key={entry}>
                    <ListItemText primary={entry} />
                  </ListItem>
                ))}
              </List>
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
            disabled={importValidCount === 0 || importStatus === 'uploading'}
          >
            {t('import.start')}
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
