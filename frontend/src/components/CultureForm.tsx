/**
 * Culture Form component for creating and editing cultures.
 * 
 * Provides a comprehensive form with validation for all culture fields.
 * Organizes fields into collapsible sections for better UX.
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface CultureFormProps {
  culture?: Culture;
  onSave: (culture: Culture) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  [key: string]: string;
}

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
    germination_rate: undefined,
    safety_margin: undefined,
    internal_article_number: '',
    notes: '',
    growth_duration_weeks: undefined,
    harvest_duration_weeks: undefined,
    propagation_time_weeks: undefined,
    harvest_method: '',
    expected_yield: undefined,
    required_yield_per_share_per_week: undefined,
    allow_deviation_delivery_weeks: false,
    distance_within_row_cm: undefined,
    row_spacing_cm: undefined,
    sowing_depth_cm: undefined,
    display_color: '',
    days_to_harvest: 0, // Default value, can be calculated or set
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
    if (name === 'growth_duration_weeks' && (value === undefined || value === null || value === '')) {
      return t('form.growthDurationWeeksRequired');
    }
    if (name === 'harvest_duration_weeks' && (value === undefined || value === null || value === '')) {
      return t('form.harvestDurationWeeksRequired');
    }

    // Numeric validations
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if ((name === 'germination_rate' || name === 'safety_margin') && value !== undefined && value !== null && value !== '') {
      if (numericValue < 0 || numericValue > 100) {
        return name === 'germination_rate' ? t('form.germinationRateError') : t('form.safetyMarginError');
      }
    }

    if ((name === 'growth_duration_weeks' || name === 'harvest_duration_weeks' || 
         name === 'propagation_time_weeks' || name === 'expected_yield' || 
         name === 'required_yield_per_share_per_week' || name === 'distance_within_row_cm' || 
         name === 'row_spacing_cm' || name === 'sowing_depth_cm') && 
        value !== undefined && value !== null && value !== '') {
      if (numericValue < 0) {
        return t(`form.${name}Error`);
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

    const growthError = validateField('growth_duration_weeks', formData.growth_duration_weeks);
    if (growthError) newErrors.growth_duration_weeks = growthError;

    const harvestError = validateField('harvest_duration_weeks', formData.harvest_duration_weeks);
    if (harvestError) newErrors.harvest_duration_weeks = harvestError;

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
      // Calculate days_to_harvest from weeks if not set
      const dataToSave = {
        ...formData,
        days_to_harvest: formData.days_to_harvest || 
          (formData.growth_duration_weeks ? Math.round(formData.growth_duration_weeks * 7) : 0),
      } as Culture;

      await onSave(dataToSave);
    } catch (error) {
      console.error('Error saving culture:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom>
        {isEdit ? t('form.editTitle') : t('form.createTitle')}
      </Typography>

      {/* General / Details Section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>{t('form.sectionGeneral')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
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
              fullWidth
              label={t('form.variety')}
              placeholder={t('form.varietyPlaceholder')}
              value={formData.variety}
              onChange={(e) => handleChange('variety', e.target.value)}
            />

            <TextField
              fullWidth
              label={t('form.cropFamily')}
              placeholder={t('form.cropFamilyPlaceholder')}
              value={formData.crop_family}
              onChange={(e) => handleChange('crop_family', e.target.value)}
            />

            <FormControl fullWidth>
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

            <FormControl fullWidth>
              <InputLabel>{t('form.cultivationType')}</InputLabel>
              <Select
                value={formData.cultivation_type || ''}
                onChange={(e) => handleChange('cultivation_type', e.target.value)}
                label={t('form.cultivationType')}
              >
                <MenuItem value="">{t('noData')}</MenuItem>
                <MenuItem value="direct_sowing">{t('form.cultivationTypeDirectSowing')}</MenuItem>
                <MenuItem value="transplant">{t('form.cultivationTypeTransplant')}</MenuItem>
                <MenuItem value="pre_cultivation">{t('form.cultivationTypePreCultivation')}</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label={t('form.germinationRate')}
              placeholder={t('form.germinationRatePlaceholder')}
              value={formData.germination_rate ?? ''}
              onChange={(e) => handleChange('germination_rate', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('germination_rate')}
              error={Boolean(errors.germination_rate)}
              helperText={errors.germination_rate}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
            />

            <TextField
              fullWidth
              type="number"
              label={t('form.safetyMargin')}
              placeholder={t('form.safetyMarginPlaceholder')}
              value={formData.safety_margin ?? ''}
              onChange={(e) => handleChange('safety_margin', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('safety_margin')}
              error={Boolean(errors.safety_margin)}
              helperText={errors.safety_margin}
              inputProps={{ min: 0, max: 100, step: 0.01 }}
            />

            <TextField
              fullWidth
              label={t('form.internalArticleNumber')}
              placeholder={t('form.internalArticleNumberPlaceholder')}
              value={formData.internal_article_number}
              onChange={(e) => handleChange('internal_article_number', e.target.value)}
            />

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
        </AccordionDetails>
      </Accordion>

      {/* Timing Section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>{t('form.sectionTiming')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              required
              type="number"
              label={t('form.growthDurationWeeks')}
              placeholder={t('form.growthDurationWeeksPlaceholder')}
              value={formData.growth_duration_weeks ?? ''}
              onChange={(e) => handleChange('growth_duration_weeks', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('growth_duration_weeks')}
              error={Boolean(errors.growth_duration_weeks)}
              helperText={errors.growth_duration_weeks}
              inputProps={{ min: 0, step: 0.01 }}
            />

            <TextField
              fullWidth
              required
              type="number"
              label={t('form.harvestDurationWeeks')}
              placeholder={t('form.harvestDurationWeeksPlaceholder')}
              value={formData.harvest_duration_weeks ?? ''}
              onChange={(e) => handleChange('harvest_duration_weeks', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('harvest_duration_weeks')}
              error={Boolean(errors.harvest_duration_weeks)}
              helperText={errors.harvest_duration_weeks}
              inputProps={{ min: 0, step: 0.01 }}
            />

            <TextField
              fullWidth
              type="number"
              label={t('form.propagationTimeWeeks')}
              placeholder={t('form.propagationTimeWeeksPlaceholder')}
              value={formData.propagation_time_weeks ?? ''}
              onChange={(e) => handleChange('propagation_time_weeks', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('propagation_time_weeks')}
              error={Boolean(errors.propagation_time_weeks)}
              helperText={errors.propagation_time_weeks}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Harvest Information Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>{t('form.sectionHarvest')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>{t('form.harvestMethod')}</InputLabel>
              <Select
                value={formData.harvest_method || ''}
                onChange={(e) => handleChange('harvest_method', e.target.value)}
                label={t('form.harvestMethod')}
              >
                <MenuItem value="">{t('noData')}</MenuItem>
                <MenuItem value="per_plant">{t('form.harvestMethodPerPlant')}</MenuItem>
                <MenuItem value="per_sqm">{t('form.harvestMethodPerSqm')}</MenuItem>
                <MenuItem value="per_bed">{t('form.harvestMethodPerBed')}</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              type="number"
              label={t('form.expectedYield')}
              placeholder={t('form.expectedYieldPlaceholder')}
              value={formData.expected_yield ?? ''}
              onChange={(e) => handleChange('expected_yield', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('expected_yield')}
              error={Boolean(errors.expected_yield)}
              helperText={errors.expected_yield}
              inputProps={{ min: 0, step: 0.01 }}
            />

            <TextField
              fullWidth
              type="number"
              label={t('form.requiredYieldPerSharePerWeek')}
              placeholder={t('form.requiredYieldPerSharePerWeekPlaceholder')}
              value={formData.required_yield_per_share_per_week ?? ''}
              onChange={(e) => handleChange('required_yield_per_share_per_week', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('required_yield_per_share_per_week')}
              error={Boolean(errors.required_yield_per_share_per_week)}
              helperText={errors.required_yield_per_share_per_week}
              inputProps={{ min: 0, step: 0.01 }}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.allow_deviation_delivery_weeks || false}
                  onChange={(e) => handleChange('allow_deviation_delivery_weeks', e.target.checked)}
                />
              }
              label={t('form.allowDeviationDeliveryWeeks')}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Planting Distances Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>{t('form.sectionPlanting')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              type="number"
              label={t('form.distanceWithinRowCm')}
              placeholder={t('form.distanceWithinRowCmPlaceholder')}
              value={formData.distance_within_row_cm ?? ''}
              onChange={(e) => handleChange('distance_within_row_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('distance_within_row_cm')}
              error={Boolean(errors.distance_within_row_cm)}
              helperText={errors.distance_within_row_cm}
              inputProps={{ min: 0, step: 0.01 }}
            />

            <TextField
              fullWidth
              type="number"
              label={t('form.rowSpacingCm')}
              placeholder={t('form.rowSpacingCmPlaceholder')}
              value={formData.row_spacing_cm ?? ''}
              onChange={(e) => handleChange('row_spacing_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('row_spacing_cm')}
              error={Boolean(errors.row_spacing_cm)}
              helperText={errors.row_spacing_cm}
              inputProps={{ min: 0, step: 0.01 }}
            />

            <TextField
              fullWidth
              type="number"
              label={t('form.sowingDepthCm')}
              placeholder={t('form.sowingDepthCmPlaceholder')}
              value={formData.sowing_depth_cm ?? ''}
              onChange={(e) => handleChange('sowing_depth_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
              onBlur={() => handleBlur('sowing_depth_cm')}
              error={Boolean(errors.sowing_depth_cm)}
              helperText={errors.sowing_depth_cm}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Display Color Section */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>{t('form.sectionColor')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              type="color"
              label={t('form.displayColor')}
              value={formData.display_color || '#3498db'}
              onChange={(e) => handleChange('display_color', e.target.value)}
              onBlur={() => handleBlur('display_color')}
              error={Boolean(errors.display_color)}
              helperText={errors.display_color || t('form.displayColorHelp')}
              inputProps={{ style: { height: '50px' } }}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

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
