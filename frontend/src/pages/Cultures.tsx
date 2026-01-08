/**
 * Cultures (Kulturen) page component.
 * 
 * Displays crop culture details with searchable dropdown.
 * Includes create and edit functionality for cultures.
 * UI text is in German, code comments remain in English.
 * 
 * @returns The Cultures page component
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import { cultureAPI, type Culture } from '../api/api';
import { CultureDetail } from '../components/CultureDetail';
import { CultureForm } from '../components/CultureForm';
import { Box, Button, Dialog, DialogContent, Snackbar, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function Cultures(): React.ReactElement {
  const { t } = useTranslation('cultures');
  const [cultures, setCultures] = useState<Culture[]>([]);
  const [selectedCultureId, setSelectedCultureId] = useState<number | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [editingCulture, setEditingCulture] = useState<Culture | undefined>(undefined);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

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
      if (editingCulture) {
        await cultureAPI.update(editingCulture.id!, culture);
        showSnackbar(t('messages.updateSuccess'), 'success');
      } else {
        await cultureAPI.create(culture);
        showSnackbar(t('messages.createSuccess'), 'success');
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

  const selectedCulture = cultures.find(c => c.id === selectedCultureId);

  return (
    <div className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <h1>{t('title')}</h1>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddNew}
        >
          {t('buttons.addNew')}
        </Button>
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

