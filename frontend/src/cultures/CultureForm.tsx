/**
 * Culture Form component for creating and editing cultures.
 * 
 * Provides a comprehensive form with validation for all culture fields.
 * All fields are visible without collapsible sections.
 * UI text is in German, code comments remain in English.
 * 
 * @param props - Component properties
 * @param props.culture - Existing culture for editing (optional)
 * @param props.onSave - Callback when culture is saved
 * @param props.onCancel - Callback when form is cancelled
 * @returns JSX element rendering the culture form
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import type { Culture } from '../api/types';
import { mediaFileAPI } from '../api/api';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { extractApiErrorMessage } from '../api/errors';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Button,
  Typography,
} from '@mui/material';
import { validateCulture } from './validation';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { TimingSection } from './sections/TimingSection';
import { HarvestSection } from './sections/HarvestSection';
import { SpacingSection } from './sections/SpacingSection';
import { SeedingSection } from './sections/SeedingSection';
import { ColorSection } from './sections/ColorSection';
import { NotesSection } from './sections/NotesSection';

interface CultureFormProps {
  culture?: Culture;
  onSave: (culture: Culture) => Promise<void>;
  onCancel: () => void;
}

// Default color for display color picker
const DEFAULT_DISPLAY_COLOR = '#3498db';

// Empty culture template
const EMPTY_CULTURE: Partial<Culture> = {
  name: '',
  variety: '',
  crop_family: '',
  nutrient_demand: '',
  cultivation_type: 'pre_cultivation',
  notes: '',
  growth_duration_days: undefined,
  harvest_duration_days: undefined,
  propagation_duration_days: undefined,
  expected_yield: undefined,
  allow_deviation_delivery_weeks: false,
  distance_within_row_cm: undefined,
  row_spacing_cm: undefined,
  sowing_depth_cm: undefined,
  display_color: '',
  sowing_calculation_safety_percent: 0,
  thousand_kernel_weight_g: undefined,
  package_size_g: undefined,
  seeding_requirement: undefined,
  seeding_requirement_type: '',
  seed_rate_value: null,
  seed_rate_unit: null,
};

/**
 * Renders the CultureForm as a modal dialog. The dialog can only be closed via Save or Cancel.
 *
 * @remarks
 * Prevents closing by clicking outside.
 */
export function CultureForm({
  culture,
  onSave,
  onCancel,
}: CultureFormProps): React.ReactElement {
  const { t } = useTranslation('cultures');
  const isEdit = Boolean(culture);
  const [saveError, setSaveError] = useState<string>('');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // --- Validation now imported from ../cultures/validation ---

  // Save function for the autosave hook
  const saveCulture = async (draft: Partial<Culture>): Promise<Partial<Culture>> => {
    const dataToSave: Culture = {
      ...(draft as Culture),
    };
    await onSave(dataToSave);
    return dataToSave;
  };

  // Local form state (no autosave)
  const [formData, setFormData] = useState<Partial<Culture>>(culture || EMPTY_CULTURE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

  const undoRedo = useUndoRedo({
    applyCommand: (command, direction) => {
      setFormData((prev) => ({
        ...prev,
        [command.fieldPath]: direction === 'undo' ? command.oldValue as never : command.newValue as never,
      }));
    },
  });

  const formRef = useRef<HTMLFormElement | null>(null);

  // Validate on every change
  const validateAndSet = (draft: Partial<Culture>) => {
    const result = validateCulture(draft, t);
    setErrors(result.errors);
    setIsValid(result.isValid);
    return result.isValid;
  };

  // Handle field changes
  // Strongly typed change handler
  const handleChange = <K extends keyof Culture>(name: K, value: Culture[K]) => {
    setFormData((prev) => {
      const oldValue = prev[name];
      let updated = { ...prev, [name]: value };
      if (name === 'seed_rate_unit' && (!value || value === '')) {
        updated = { ...updated, seed_rate_value: null };
      }
      undoRedo.pushCommand({
        entityType: 'culture',
        entityId: prev.id ?? 'draft',
        fieldPath: String(name),
        oldValue,
        newValue: updated[name],
        timestamp: Date.now(),
      });
      setIsDirty(true);
      validateAndSet(updated);
      return updated;
    });
  };

  // Handle manual save (for Save button)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAndSet(formData)) return;
    setIsSaving(true);
    try {
      let nextData = formData;
      if (pendingImageFile) {
        const upload = await mediaFileAPI.upload(pendingImageFile);
        nextData = { ...nextData, image_file_id: upload.data.id };
      }
      await saveCulture(nextData);
      setShowSaveSuccess(true);
      setIsDirty(false);
    } catch (error) {
      setSaveError(extractApiErrorMessage(error, t, t('messages.updateError')));
    } finally {
      setIsSaving(false);
    }
  };


  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const isInsideForm = active instanceof Element && Boolean(formRef.current?.contains(active));
      if (!isInsideForm) {
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        if (undoRedo.redo()) {
          event.preventDefault();
        }
        return;
      }

      if (event.key.toLowerCase() === 'z') {
        if (undoRedo.undo()) {
          event.preventDefault();
        }
        return;
      }

      if (event.key.toLowerCase() === 'y') {
        if (undoRedo.redo()) {
          event.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoRedo]);

  return (
    <Dialog
      open
      onClose={(_event, reason) => {
        if (reason === 'backdropClick') return;
        onCancel();
      }}
      aria-labelledby="culture-form-dialog-title"
      maxWidth="md"
      fullWidth
    >
      <form ref={formRef} onSubmit={handleSubmit}>
        <DialogTitle id="culture-form-dialog-title">
          {isEdit ? t('form.editTitle') : t('form.createTitle')}
        </DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '70vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
            <Typography variant="h6">Allgemeine Informationen</Typography>
            <BasicInfoSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <TimingSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <HarvestSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <SpacingSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <SeedingSection formData={formData} errors={errors} onChange={handleChange} t={t} />
            <ColorSection formData={formData} errors={errors} onChange={handleChange} t={t} defaultColor={DEFAULT_DISPLAY_COLOR} />
            <NotesSection formData={formData} onChange={handleChange} t={t} errors={errors} />
            <Button component="label" variant="outlined">Bild auswählen
              <input hidden type="file" accept="image/*" onChange={(e) => setPendingImageFile(e.target.files?.[0] ?? null)} />
            </Button>
            {pendingImageFile && <Typography variant="body2">{pendingImageFile.name}</Typography>}
          </div>
        </DialogContent>
        <DialogActions sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center', mt: 1 }}>
          {isDirty && (
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {isValid
                ? t('messages.unsavedChanges', { defaultValue: 'Unsaved changes' })
                : t('messages.fixErrors', { defaultValue: 'Please fix validation errors' })}
            </Typography>
          )}
          <Button onClick={undoRedo.undo} disabled={isSaving || !undoRedo.canUndo}>
            Undo (Ctrl+Z)
          </Button>
          <Button onClick={undoRedo.redo} disabled={isSaving || !undoRedo.canRedo}>
            Redo (Ctrl+Y)
          </Button>
          <Button onClick={onCancel} disabled={isSaving}>
            {t('form.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSaving || !isValid}
          >
            {isSaving
              ? t('messages.saving', { defaultValue: 'Saving...' })
              : isEdit ? t('form.save') : t('form.create')}
          </Button>
        </DialogActions>
      </form>
      <Snackbar
        open={showSaveSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setShowSaveSuccess(false)}>
          {t('messages.updateSuccess', { defaultValue: 'Saved successfully' })}
        </Alert>
      </Snackbar>
      <Snackbar
        open={Boolean(saveError)}
        autoHideDuration={6000}
        onClose={() => setSaveError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
