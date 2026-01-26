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

import { useState } from 'react';
import { Tooltip } from '@mui/material';
import { useTranslation } from '../i18n';
import type { Culture } from '../api/types';
import { type ValidationResult } from '../hooks/autosave';
import {
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

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
  seeding_requirement: undefined,
  seeding_requirement_type: '',
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

  const validateCulture = (draft: Partial<Culture>): ValidationResult => {
    const errors: Record<string, string> = {};

    // Required field: name
    if (!draft.name) {
      errors.name = t('form.nameRequired');
    }
                    // onBlur removed (was undefined)
    // Required field: name
    if (!draft.name) {
      errors.name = t('form.nameRequired');
    }
    // Required field: growth_duration_days
    if (draft.growth_duration_days === undefined || draft.growth_duration_days === null || (draft.growth_duration_days as unknown) === '') {
      errors.growth_duration_days = t('form.growthDurationDaysRequired');
    } else {
      const numValue = typeof draft.growth_duration_days === 'string' ? parseFloat(draft.growth_duration_days as string) : draft.growth_duration_days;
      if (numValue < 0) {
        errors.growth_duration_days = t('form.growthDurationDaysError');
      }
    }
    if (draft.harvest_duration_days === undefined || draft.harvest_duration_days === null || (draft.harvest_duration_days as unknown) === '') {
      errors.harvest_duration_days = t('form.harvestDurationDaysRequired');
    } else {
      const numValue = typeof draft.harvest_duration_days === 'string' ? parseFloat(draft.harvest_duration_days as string) : draft.harvest_duration_days;
      if (numValue < 0) {
        errors.harvest_duration_days = t('form.harvestDurationDaysError');
      }
    }
    // Pflichtfeld: propagation_duration_days, außer bei Direktsaat
    if (draft.cultivation_type !== 'direct_sowing') {
      if (
        draft.propagation_duration_days === undefined ||
        draft.propagation_duration_days === null ||
        (draft.propagation_duration_days as unknown) === ''
      ) {
        errors.propagation_duration_days = t('form.propagationDurationDaysRequired');
      } else {
        const numValue = typeof draft.propagation_duration_days === 'string' ? parseFloat(draft.propagation_duration_days as string) : draft.propagation_duration_days;
        if (numValue < 0) {
          errors.propagation_duration_days = t('form.propagationDurationDaysError');
        }
      }
    }
    // Optional numeric fields validation (alle außer propagation_duration_days)
    const numericFields = [
      'expected_yield',
      'distance_within_row_cm',
      'row_spacing_cm',
      'sowing_depth_cm',
      'sowing_calculation_safety_percent',
    ];
    numericFields.forEach(field => {
      const value = draft[field as keyof Culture];
      if (value !== undefined && value !== null && value !== '') {
        const numValue = typeof value === 'string' ? parseFloat(value as string) : (value as number);
        if (numValue < 0) {
          errors[field] = t(`form.${field}Error`, { defaultValue: t('form.growthDurationDaysError') });
        }
      }
    });
    // Display color validation
    if (draft.display_color && !/^#[0-9A-Fa-f]{6}$/.test(draft.display_color)) {
      errors.display_color = t('form.displayColorError');
    }

    // Wenn expected_yield gesetzt ist, muss auch harvest_method gewählt sein
    if (
      draft.expected_yield !== undefined && draft.expected_yield !== null && typeof draft.expected_yield === 'number' &&
      (!draft.harvest_method)
    ) {
      errors.harvest_method = t('form.harvestMethodRequired');
    }
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

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

  // Validate on every change
  const validateAndSet = (draft: Partial<Culture>) => {
    const result = validateCulture(draft);
    setErrors(result.errors);
    setIsValid(result.isValid);
    return result.isValid;
  };

  // Handle field changes
  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
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
      await saveCulture(formData);
      setShowSaveSuccess(true);
      setIsDirty(false);
    } catch (error) {
      setSaveError((error as Error)?.message || t('messages.updateError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={(_event, reason) => {
        // Prevent closing by backdrop click
        if (reason === 'backdropClick') { // || reason === 'escapeKeyDown') {
          return;
        }
        onCancel();
      }}
      aria-labelledby="culture-form-dialog-title"
      maxWidth="md"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle id="culture-form-dialog-title">
          {isEdit ? t('form.editTitle') : t('form.createTitle')}
        </DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '70vh' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Basic Information */}
            <Typography variant="h6">Allgemeine Informationen</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                sx={{ flex: '1 1 45%', minWidth: '200px' }}
                required
                label={t('form.name')}
                placeholder={t('form.namePlaceholder')}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                // onBlur entfernt, handleBlur ist nicht definiert
                error={Boolean(errors.name)}
                helperText={errors.name}
              />
              <TextField
                sx={{ flex: '1 1 45%', minWidth: '200px' }}
                label={t('form.variety')}
                placeholder={t('form.varietyPlaceholder')}
                value={formData.variety}
                onChange={(e) => handleChange('variety', e.target.value)}
                // onBlur entfernt, handleBlur ist nicht definiert
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                sx={{ flex: '1 1 45%', minWidth: '200px' }}
                label={t('form.cropFamily')}
                placeholder={t('form.cropFamilyPlaceholder')}
                value={formData.crop_family}
                onChange={(e) => handleChange('crop_family', e.target.value)}
                // onBlur entfernt, handleBlur ist nicht definiert
              />
              <FormControl sx={{ flex: '1 1 45%', minWidth: '200px' }}>
                <InputLabel>{t('form.nutrientDemand')}</InputLabel>
                <Select
                  value={formData.nutrient_demand || ''}
                  onChange={(e) => handleChange('nutrient_demand', e.target.value)}
                  // onBlur entfernt, handleBlur ist nicht definiert
                  label={t('form.nutrientDemand')}
                >
                  <MenuItem value="">{t('noData')}</MenuItem>
                  <MenuItem value="low">{t('form.nutrientDemandLow')}</MenuItem>
                  <MenuItem value="medium">{t('form.nutrientDemandMedium')}</MenuItem>
                  <MenuItem value="high">{t('form.nutrientDemandHigh')}</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {/* Timing */}
            <Typography variant="h6" sx={{ mt: 2 }}>Zeitplanung</Typography>
            {/* Zeitplanung UX Section */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Anbauart in einer Zeile */}
              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                <FormControl sx={{ minWidth: '180px' }}>
                  <InputLabel id="anbauart-label">Anbauart</InputLabel>
                  <Select
                    labelId="anbauart-label"
                    value={formData.cultivation_type || ''}
                    label="Anbauart"
                    onChange={e => {
                      const val = e.target.value;
                      handleChange('cultivation_type', val);
                      if (val === 'direct_sowing') {
                        handleChange('propagation_duration_days', 0);
                      }
                    }}
                  >
                    <MenuItem value="">{t('noData')}</MenuItem>
                    <MenuItem value="pre_cultivation">Anzucht</MenuItem>
                    <MenuItem value="direct_sowing">Direktsaat</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {/* Zeiten nebeneinander */}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {/* Wachstumszeitraum (Pflichtfeld) */}
                <Tooltip title="Wachstumszeitraum = Gesamtzeit von Saat bis Ernte." arrow>
                  <TextField
                    required
                    sx={{ flex: '1 1 22%', minWidth: '150px' }}
                    type="number"
                    label={t('form.growthDurationDays') + ' *'}
                    placeholder={t('form.growthDurationDaysPlaceholder')}
                    value={formData.growth_duration_days ?? ''}
                    onChange={e => handleChange('growth_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
                    error={Boolean(errors.growth_duration_days)}
                    helperText={errors.growth_duration_days}
                    inputProps={{ min: 1, step: 1 }}
                  />
                </Tooltip>
                {/* Erntezeitraum (Pflichtfeld) */}
                <TextField
                  required
                  sx={{ flex: '1 1 22%', minWidth: '150px' }}
                  type="number"
                  label={t('form.harvestDurationDays') + ' *'}
                  placeholder={t('form.harvestDurationDaysPlaceholder')}
                  value={formData.harvest_duration_days ?? ''}
                  onChange={e => handleChange('harvest_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
                  error={Boolean(errors.harvest_duration_days)}
                  helperText={errors.harvest_duration_days}
                  inputProps={{ min: 0, step: 1 }}
                />
                {/* Anzuchtdauer (Pflichtfeld außer bei Direktsaat) */}
                <Tooltip title={formData.cultivation_type === 'direct_sowing' ? 'Bei Direktsaat ist keine Anzuchtdauer erforderlich.' : ''} arrow>
                  <TextField
                    required={formData.cultivation_type !== 'direct_sowing'}
                    sx={{ flex: '1 1 22%', minWidth: '150px' }}
                    type="number"
                    label={"Anzuchtdauer (Tage)" + (formData.cultivation_type !== 'direct_sowing' ? ' *' : '')}
                    value={formData.cultivation_type === 'direct_sowing' ? 0 : (formData.propagation_duration_days ?? '')}
                    onChange={e => handleChange('propagation_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
                    disabled={formData.cultivation_type === 'direct_sowing'}
                    error={Boolean(errors.propagation_duration_days) || ((formData.propagation_duration_days ?? 0) > (formData.growth_duration_days ?? 0))}
                    helperText={
                      errors.propagation_duration_days
                        || ((formData.propagation_duration_days ?? 0) > (formData.growth_duration_days ?? 0)
                          ? t('form.propagationDurationDaysTooLong')
                          : undefined)
                    }
                    inputProps={{ min: 0, step: 1 }}
                  />
                </Tooltip>
              </Box>
            </Box>
            {/* Harvest Information */}
            <Typography variant="h6" sx={{ mt: 2 }}>Ernteinformationen</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ flex: '1 1 45%', minWidth: '200px' }} error={Boolean(errors.harvest_method)}>
                <InputLabel>{t('form.harvestMethod')}</InputLabel>
                <Select
                  value={formData.harvest_method || ''}
                  onChange={(e) => handleChange('harvest_method', e.target.value)}
                  label={t('form.harvestMethod')}
                >
                  <MenuItem value="">{t('noData')}</MenuItem>
                  <MenuItem value="per_plant">{t('form.harvestMethodPerPlant')}</MenuItem>
                  <MenuItem value="per_sqm">{t('form.harvestMethodPerSqm')}</MenuItem>
                </Select>
                {errors.harvest_method && (
                  <Typography variant="caption" color="error">{t('form.harvestMethodRequired')}</Typography>
                )}
              </FormControl>
              <TextField
                sx={{ flex: '1 1 45%', minWidth: '200px' }}
                type="number"
                label={t('form.expectedYield')}
                placeholder={t('form.expectedYieldPlaceholder')}
                value={formData.expected_yield ?? ''}
                onChange={(e) => handleChange('expected_yield', e.target.value ? parseFloat(e.target.value) : undefined)}
                // onBlur entfernt, handleBlur ist nicht definiert
                error={Boolean(errors.expected_yield)}
                helperText={errors.expected_yield}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              />
            </Box>
            {/* Planting Distances */}
            <Typography variant="h6" sx={{ mt: 2 }}>Pflanzabstände</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                sx={{ flex: '1 1 30%', minWidth: '200px' }}
                type="number"
                label={t('form.distanceWithinRowCm', { defaultValue: 'Abstand in der Reihe (cm)' })}
                placeholder={t('form.distanceWithinRowCmPlaceholder', { defaultValue: 'z.B. 25' })}
                value={formData.distance_within_row_cm ?? ''}
                onChange={(e) => handleChange('distance_within_row_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                error={Boolean(errors.distance_within_row_cm)}
                helperText={errors.distance_within_row_cm}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              />
              <TextField
                sx={{ flex: '1 1 30%', minWidth: '200px' }}
                type="number"
                label={t('form.rowSpacingCm', { defaultValue: 'Reihenabstand (cm)' })}
                placeholder={t('form.rowSpacingCmPlaceholder', { defaultValue: 'z.B. 40' })}
                value={formData.row_spacing_cm ?? ''}
                onChange={(e) => handleChange('row_spacing_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                error={Boolean(errors.row_spacing_cm)}
                helperText={errors.row_spacing_cm}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              />
              <TextField
                sx={{ flex: '1 1 30%', minWidth: '200px' }}
                type="number"
                label={t('form.sowingDepthCm', { defaultValue: 'Saattiefe (cm)' })}
                placeholder={t('form.sowingDepthCmPlaceholder', { defaultValue: 'z.B. 2' })}
                value={formData.sowing_depth_cm ?? ''}
                onChange={(e) => handleChange('sowing_depth_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
                error={Boolean(errors.sowing_depth_cm)}
                helperText={errors.sowing_depth_cm}
                slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
              />
            </Box>

            {/* Seeding Information */}
            <Typography variant="h6" sx={{ mt: 2 }}>Saatgut & Aussaat</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ flex: '1 1 30%', minWidth: '200px' }}>
                <InputLabel>{t('form.seedingRequirementType', { defaultValue: 'Saatgutbedarf-Typ' })}</InputLabel>
                <Select
                  value={formData.seeding_requirement_type || ''}
                  label={t('form.seedingRequirementType', { defaultValue: 'Saatgutbedarf-Typ' })}
                  onChange={e => handleChange('seeding_requirement_type', e.target.value)}
                >
                  <MenuItem value="">{t('noData', { defaultValue: 'Keine Angabe' })}</MenuItem>
                  <MenuItem value="per_sqm">{t('form.seedingRequirementPerSqm', { defaultValue: 'pro m²' })}</MenuItem>
                  <MenuItem value="per_plant">{t('form.seedingRequirementPerPlant', { defaultValue: 'pro Pflanze' })}</MenuItem>
                </Select>
              </FormControl>
              <Tooltip title={t('form.seedingRequirementHelp', { defaultValue: 'Menge pro gewähltem Typ (g, Stück, etc.)' })} arrow>
                <span style={{ display: 'flex', flex: 1 }}>
                  <TextField
                    sx={{ flex: '1 1 30%', minWidth: '200px' }}
                    type="number"
                    label={t('form.seedingRequirement', { defaultValue: 'Saatgutbedarf' })}
                    placeholder={t('form.seedingRequirementPlaceholder', { defaultValue: 'z.B. 0.5' })}
                    value={formData.seeding_requirement ?? ''}
                    onChange={(e) => handleChange('seeding_requirement', e.target.value ? parseFloat(e.target.value) : undefined)}
                    error={Boolean(errors.seeding_requirement)}
                    slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                  />
                </span>
              </Tooltip>
              <Tooltip title={t('form.sowingCalculationSafetyPercentHelp', { defaultValue: 'Prozentualer Zuschlag zur berechneten Saatgutmenge.' })} arrow>
                <span style={{ display: 'flex', flex: 1 }}>
                  <TextField
                    sx={{ flex: '1 1 30%', minWidth: '200px', ml: 'auto' }}
                    type="number"
                    label={t('form.sowingCalculationSafetyPercentLabel', { defaultValue: 'Sicherheitszuschlag für Saatgut (%)' })}
                    placeholder={t('form.sowingCalculationSafetyPercentPlaceholder', { defaultValue: 'z.B. 10' })}
                    value={formData.sowing_calculation_safety_percent ?? ''}
                    onChange={(e) => handleChange('sowing_calculation_safety_percent', e.target.value ? parseFloat(e.target.value) : undefined)}
                    error={Boolean(errors.sowing_calculation_safety_percent)}
                    slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
                  />
                </span>
              </Tooltip>

            </Box>
            {/* Display Color */}
            <Typography variant="h6" sx={{ mt: 2 }}>Anzeigefarbe</Typography>
            <TextField
              sx={{ maxWidth: '300px' }}
              type="color"
              label={t('form.displayColor')}
              value={formData.display_color || DEFAULT_DISPLAY_COLOR}
              onChange={(e) => handleChange('display_color', e.target.value)}
              // onBlur entfernt, handleBlur ist nicht definiert
              error={Boolean(errors.display_color)}
              helperText={errors.display_color || t('form.displayColorHelp')}
              slotProps={{ input: { style: { height: '50px' } } }}
            />
            {/* Notes */}
            <Typography variant="h6" sx={{ mt: 2 }}>Notizen</Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label={t('form.notes')}
              placeholder={t('form.notesPlaceholder')}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center', mt: 1 }}>
          {isDirty && (
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {isValid
                ? t('messages.unsavedChanges', { defaultValue: 'Unsaved changes' })
                : t('messages.fixErrors', { defaultValue: 'Please fix validation errors' })
              }
            </Typography>
          )}
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
              : isEdit ? t('form.save') : t('form.create')
            }
          </Button>
        </DialogActions>
      </form>
      {/* Success Snackbar */}
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
      {/* Error Snackbar */}
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
