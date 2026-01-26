/**
 * HarvestSection: Harvest method, expected yield
 * @remarks Presentational, no internal state
 */
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import type { Culture } from '../../../api/types';
import type { TFunction } from 'i18next';

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
        <FormControl sx={{ flex: '1 1 45%', minWidth: '200px' }} error={Boolean(errors.harvest_method)}>
          <InputLabel>{t('form.harvestMethod')}</InputLabel>
          <Select
            value={formData.harvest_method || ''}
            onChange={e => onChange('harvest_method', e.target.value)}
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
          onChange={e => onChange('expected_yield', e.target.value ? parseFloat(e.target.value) : undefined)}
          error={Boolean(errors.expected_yield)}
          helperText={errors.expected_yield}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
      </Box>
    </>
  );
}
