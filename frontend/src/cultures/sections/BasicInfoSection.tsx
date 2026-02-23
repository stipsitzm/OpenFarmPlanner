/**
 * BasicInfoSection: Name, Variety, Supplier, Crop Family, Nutrient Demand
 * @remarks Presentational, no internal state
 */
import { Box, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { fieldSx } from './styles.tsx';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';

interface BasicInfoSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function BasicInfoSection({ formData, errors, onChange, t }: BasicInfoSectionProps) {


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
          required
          label={t('form.variety')}
          placeholder={t('form.varietyPlaceholder')}
          value={formData.variety}
          onChange={e => onChange('variety', e.target.value)}
          error={Boolean(errors.variety)}
          helperText={errors.variety}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          sx={fieldSx}
          required
          label={t('form.supplier', { defaultValue: 'Saatgutlieferant' })}
          placeholder={t('form.supplierPlaceholder', { defaultValue: 'z.B. Bingenheimer' })}
          helperText={errors.seed_supplier || t('form.supplierHelp', { defaultValue: 'Tippen zum Suchen oder neue Lieferanten anlegen' })}
          value={formData.seed_supplier || ''}
          onChange={e => onChange('seed_supplier', e.target.value)}
          error={Boolean(errors.seed_supplier)}
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
