/**
 * BasicInfoSection: Name, Variety, Supplier, Crop Family, Nutrient Demand
 * @remarks Presentational, no internal state
 */
import { useState } from 'react';
import { Box, TextField, FormControl, InputLabel, Select, MenuItem, Autocomplete } from '@mui/material';
import { fieldSx } from '../styles.tsx';
import type { Culture, Supplier } from '../../../api/types';
import type { TFunction } from 'i18next';
import { supplierAPI } from '../../../api/api';

interface BasicInfoSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function BasicInfoSection({ formData, errors, onChange, t }: BasicInfoSectionProps) {
  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(false);

  // Handle supplier autocomplete input change
  const handleSupplierInputChange = async (_event: React.SyntheticEvent, value: string) => {
    if (value.length < 2) {
      setSupplierOptions([]);
      return;
    }

    setSupplierLoading(true);
    try {
      const response = await supplierAPI.list(value);
      setSupplierOptions(response.data.results || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSupplierOptions([]);
    } finally {
      setSupplierLoading(false);
    }
  };

  // Handle supplier selection or creation
  const handleSupplierChange = async (_event: React.SyntheticEvent, value: Supplier | string | null) => {
    if (!value) {
      // Clear supplier
      onChange('supplier', null);
      return;
    }

    if (typeof value === 'string') {
      // User typed a new supplier name - create it
      try {
        const response = await supplierAPI.create(value);
        onChange('supplier', response.data);
      } catch (error) {
        console.error('Error creating supplier:', error);
      }
    } else {
      // User selected an existing supplier
      onChange('supplier', value);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          sx={fieldSx}
          required
          label={t('form.name')}
          placeholder={t('form.namePlaceholder')}
          value={formData.name}
          onChange={e => onChange('name', e.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name}
        />
        <TextField
          sx={fieldSx}
          label={t('form.variety')}
          placeholder={t('form.varietyPlaceholder')}
          value={formData.variety}
          onChange={e => onChange('variety', e.target.value)}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Autocomplete
          sx={fieldSx}
          options={supplierOptions}
          value={formData.supplier || null}
          onChange={handleSupplierChange}
          onInputChange={handleSupplierInputChange}
          getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={supplierLoading}
          freeSolo
          selectOnFocus
          clearOnBlur
          handleHomeEndKeys
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('form.supplier', { defaultValue: 'Saatgutlieferant' })}
              placeholder={t('form.supplierPlaceholder', { defaultValue: 'z.B. Bingenheimer' })}
              helperText={t('form.supplierHelp', { defaultValue: 'Tippen zum Suchen oder neue Lieferanten anlegen' })}
            />
          )}
        />
        <TextField
          sx={fieldSx}
          label={t('form.cropFamily')}
          placeholder={t('form.cropFamilyPlaceholder')}
          value={formData.crop_family}
          onChange={e => onChange('crop_family', e.target.value)}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl sx={fieldSx}>
          <InputLabel>{t('form.nutrientDemand')}</InputLabel>
          <Select
            value={formData.nutrient_demand || ''}
            onChange={e => onChange('nutrient_demand', e.target.value)}
            label={t('form.nutrientDemand')}
            fullWidth
          >
            <MenuItem value="">{t('noData')}</MenuItem>
            <MenuItem value="low">{t('form.nutrientDemandLow')}</MenuItem>
            <MenuItem value="medium">{t('form.nutrientDemandMedium')}</MenuItem>
            <MenuItem value="high">{t('form.nutrientDemandHigh')}</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </>
  );
}
