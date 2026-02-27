/**
 * HarvestSection: Harvest method, expected yield
 * @remarks Presentational, no internal state
 */
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';
import { fieldSx } from './styles.tsx';

interface HarvestSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function HarvestSection({ formData, errors, onChange, t }: HarvestSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>Ernteinformationen</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl sx={fieldSx} error={Boolean(errors.harvest_method)}>
          <InputLabel>{t('form.harvestMethod')}</InputLabel>
          <Select
            value={formData.harvest_method || ''}
            onChange={e => onChange('harvest_method', e.target.value)}
            label={t('form.harvestMethod')}
            fullWidth
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
          sx={fieldSx}
          type="number"
          label={t('form.expectedYield')}
          placeholder={t('form.expectedYieldPlaceholder')}
          value={formData.expected_yield ?? ''}
          onChange={e => onChange('expected_yield', e.target.value ? parseFloat(e.target.value) : undefined)}
          error={Boolean(errors.expected_yield)}
          helperText={errors.expected_yield}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        <FormControl sx={fieldSx} error={Boolean(errors.expected_yield_unit)}>
          <InputLabel>{t('form.expectedYieldUnit')}</InputLabel>
          <Select
            value={formData.expected_yield_unit || ''}
            onChange={e => onChange('expected_yield_unit', e.target.value)}
            label={t('form.expectedYieldUnit')}
            fullWidth
          >
            <MenuItem value="">{t('noData')}</MenuItem>
            <MenuItem value="kg_per_m2">kg/m²</MenuItem>
            <MenuItem value="kg_per_m">kg/m</MenuItem>
            <MenuItem value="kg_per_plant">kg/Pflanze</MenuItem>
          </Select>
          {errors.expected_yield_unit && (
            <Typography variant="caption" color="error">{errors.expected_yield_unit}</Typography>
          )}
        </FormControl>
      </Box>
    </>
  );
}
