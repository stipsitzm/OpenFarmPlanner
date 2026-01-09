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

import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';
import type { Culture } from '../api/api';
import {
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography,
} from '@mui/material';

interface CultureFormProps {
  culture?: Culture;
  onSave: (culture: Culture) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  [key: string]: string;
}

// Default color for display color picker
const DEFAULT_DISPLAY_COLOR = '#3498db';

export function CultureForm({
  culture,
  onSave,
  onCancel,
}: CultureFormProps): React.ReactElement {
  const { t } = useTranslation('cultures');
  const isEdit = Boolean(culture);

  // Initialize form data
  const [formData, setFormData] = useState<Partial<Culture>>({
    name: '',
    variety: '',
    crop_family: '',
    nutrient_demand: '',
    cultivation_type: '',
    notes: '',
    growth_duration_days: undefined,
    harvest_duration_days: undefined,
    propagation_duration_days: undefined,
    harvest_method: '',
    expected_yield: undefined,
    allow_deviation_delivery_weeks: false,
    distance_within_row_cm: undefined,
    row_spacing_cm: undefined,
    sowing_depth_cm: undefined,
    display_color: '',
    days_to_harvest: 0,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load culture data for editing
  useEffect(() => {
    if (culture) {
      setFormData(culture);
    }
  }, [culture]);

  const validateField = (name: string, value: any): string | null => {
    // Required fields
    if (name === 'name' && !value) {
      return t('form.nameRequired');
    }
    if (name === 'growth_duration_days' && (value === undefined || value === null || value === '')) {
      return t('form.growthDurationDaysRequired');
    }
    if (name === 'harvest_duration_days' && (value === undefined || value === null || value === '')) {
      return t('form.harvestDurationDaysRequired');
    }

    // Numeric validations
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if ((name === 'growth_duration_days' || name === 'harvest_duration_days' || 
         name === 'propagation_duration_days' || name === 'expected_yield' || 
         name === 'distance_within_row_cm' || name === 'row_spacing_cm' || name === 'sowing_depth_cm') && 
        value !== undefined && value !== null && value !== '') {
      if (numericValue < 0) {
        return t(`form.${name}Error`, { defaultValue: t('form.growthDurationDaysError') });
      }
    }

    // Display color format validation
    if (name === 'display_color' && value && !/^#[0-9A-Fa-f]{6}$/.test(value)) {
      return t('form.displayColorError');
    }

    return null;
  };

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = (name: string) => {
    const error = validateField(name, formData[name as keyof Culture]);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate all required fields
    const nameError = validateField('name', formData.name);
    if (nameError) newErrors.name = nameError;

    const growthError = validateField('growth_duration_days', formData.growth_duration_days);
    if (growthError) newErrors.growth_duration_days = growthError;

    const harvestError = validateField('harvest_duration_days', formData.harvest_duration_days);
    if (harvestError) newErrors.harvest_duration_days = harvestError;

    // Validate all optional fields that have values
    Object.keys(formData).forEach(key => {
      const value = formData[key as keyof Culture];
      if (value !== undefined && value !== null && value !== '') {
        const error = validateField(key, value);
        if (error) newErrors[key] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Calculate days_to_harvest from growth_duration_days if not set
      const dataToSave = {
        ...formData,
        days_to_harvest: formData.days_to_harvest || formData.growth_duration_days || 0,
      } as Culture;

      await onSave(dataToSave);
    } catch (error) {
      console.error('Error saving culture:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxHeight: '80vh', overflow: 'auto', p: 2 }}>
      <Typography variant="h5" gutterBottom>
        {isEdit ? t('form.editTitle') : t('form.createTitle')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
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
            onBlur={() => handleBlur('name')}
            error={Boolean(errors.name)}
            helperText={errors.name}
          />

          <TextField
            sx={{ flex: '1 1 45%', minWidth: '200px' }}
            label={t('form.variety')}
            placeholder={t('form.varietyPlaceholder')}
            value={formData.variety}
            onChange={(e) => handleChange('variety', e.target.value)}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            sx={{ flex: '1 1 45%', minWidth: '200px' }}
            label={t('form.cropFamily')}
            placeholder={t('form.cropFamilyPlaceholder')}
            value={formData.crop_family}
            onChange={(e) => handleChange('crop_family', e.target.value)}
          />

          <FormControl sx={{ flex: '1 1 45%', minWidth: '200px' }}>
            <InputLabel>{t('form.nutrientDemand')}</InputLabel>
            <Select
              value={formData.nutrient_demand || ''}
              onChange={(e) => handleChange('nutrient_demand', e.target.value)}
              label={t('form.nutrientDemand')}
            >
              <MenuItem value="">{t('noData')}</MenuItem>
              <MenuItem value="low">{t('form.nutrientDemandLow')}</MenuItem>
              <MenuItem value="medium">{t('form.nutrientDemandMedium')}</MenuItem>
              <MenuItem value="high">{t('form.nutrientDemandHigh')}</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ flex: '1 1 45%', minWidth: '200px' }}>
            <InputLabel>{t('form.cultivationType')}</InputLabel>
            <Select
              value={formData.cultivation_type || ''}
              onChange={(e) => handleChange('cultivation_type', e.target.value)}
              label={t('form.cultivationType')}
            >
              <MenuItem value="">{t('noData')}</MenuItem>
              <MenuItem value="pre_cultivation">{t('form.cultivationTypePreCultivation')}</MenuItem>
              <MenuItem value="direct_sowing">{t('form.cultivationTypeDirectSowing')}</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Timing */}
        <Typography variant="h6" sx={{ mt: 2 }}>Zeitplanung</Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            sx={{ flex: '1 1 30%', minWidth: '200px' }}
            required
            type="number"
            label={t('form.growthDurationDays')}
            placeholder={t('form.growthDurationDaysPlaceholder')}
            value={formData.growth_duration_days ?? ''}
            onChange={(e) => handleChange('growth_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
            onBlur={() => handleBlur('growth_duration_days')}
            error={Boolean(errors.growth_duration_days)}
            helperText={errors.growth_duration_days}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
          />

          <TextField
            sx={{ flex: '1 1 30%', minWidth: '200px' }}
            required
            type="number"
            label={t('form.harvestDurationDays')}
            placeholder={t('form.harvestDurationDaysPlaceholder')}
            value={formData.harvest_duration_days ?? ''}
            onChange={(e) => handleChange('harvest_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
            onBlur={() => handleBlur('harvest_duration_days')}
            error={Boolean(errors.harvest_duration_days)}
            helperText={errors.harvest_duration_days}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
          />

          <TextField
            sx={{ flex: '1 1 30%', minWidth: '200px' }}
            type="number"
            label={t('form.propagationDurationDays')}
            placeholder={t('form.propagationDurationDaysPlaceholder')}
            value={formData.propagation_duration_days ?? ''}
            onChange={(e) => handleChange('propagation_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
            onBlur={() => handleBlur('propagation_duration_days')}
            error={Boolean(errors.propagation_duration_days)}
            helperText={errors.propagation_duration_days}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
          />
        </Box>

        {/* Harvest Information */}
        <Typography variant="h6" sx={{ mt: 2 }}>Ernteinformationen</Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ flex: '1 1 45%', minWidth: '200px' }}>
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
          </FormControl>

          <TextField
            sx={{ flex: '1 1 45%', minWidth: '200px' }}
            type="number"
            label={t('form.expectedYield')}
            placeholder={t('form.expectedYieldPlaceholder')}
            value={formData.expected_yield ?? ''}
            onChange={(e) => handleChange('expected_yield', e.target.value ? parseFloat(e.target.value) : undefined)}
            onBlur={() => handleBlur('expected_yield')}
            error={Boolean(errors.expected_yield)}
            helperText={errors.expected_yield}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              checked={formData.allow_deviation_delivery_weeks || false}
              onChange={(e) => handleChange('allow_deviation_delivery_weeks', e.target.checked)}
            />
          }
          label={t('form.allowDeviationDeliveryWeeks')}
        />

        {/* Planting Distances */}
        <Typography variant="h6" sx={{ mt: 2 }}>Pflanzabstände</Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            sx={{ flex: '1 1 30%', minWidth: '200px' }}
            type="number"
            label={t('form.distanceWithinRowCm')}
            placeholder={t('form.distanceWithinRowCmPlaceholder')}
            value={formData.distance_within_row_cm ?? ''}
            onChange={(e) => handleChange('distance_within_row_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
            onBlur={() => handleBlur('distance_within_row_cm')}
            error={Boolean(errors.distance_within_row_cm)}
            helperText={errors.distance_within_row_cm}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />

          <TextField
            sx={{ flex: '1 1 30%', minWidth: '200px' }}
            type="number"
            label={t('form.rowSpacingCm')}
            placeholder={t('form.rowSpacingCmPlaceholder')}
            value={formData.row_spacing_cm ?? ''}
            onChange={(e) => handleChange('row_spacing_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
            onBlur={() => handleBlur('row_spacing_cm')}
            error={Boolean(errors.row_spacing_cm)}
            helperText={errors.row_spacing_cm}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />

          <TextField
            sx={{ flex: '1 1 30%', minWidth: '200px' }}
            type="number"
            label={t('form.sowingDepthCm')}
            placeholder={t('form.sowingDepthCmPlaceholder')}
            value={formData.sowing_depth_cm ?? ''}
            onChange={(e) => handleChange('sowing_depth_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
            onBlur={() => handleBlur('sowing_depth_cm')}
            error={Boolean(errors.sowing_depth_cm)}
            helperText={errors.sowing_depth_cm}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        </Box>

        {/* Display Color */}
        <Typography variant="h6" sx={{ mt: 2 }}>Anzeigefarbe</Typography>

        <TextField
          sx={{ maxWidth: '300px' }}
          type="color"
          label={t('form.displayColor')}
          value={formData.display_color || DEFAULT_DISPLAY_COLOR}
          onChange={(e) => handleChange('display_color', e.target.value)}
          onBlur={() => handleBlur('display_color')}
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

      {/* Form Actions */}
      <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={isSubmitting}>
          {t('form.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
        >
          {isEdit ? t('form.save') : t('form.create')}
        </Button>
      </Box>
    </Box>
  );
}
