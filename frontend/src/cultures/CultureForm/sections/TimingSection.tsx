/**
 * TimingSection: Cultivation type, growth/harvest/propagation durations
 * @remarks Presentational, no internal state
 */
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, TextField, Tooltip } from '@mui/material';
import type { Culture } from '../../../api/types';
import type { TFunction } from 'i18next';

interface TimingSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function TimingSection({ formData, errors, onChange, t }: TimingSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>Zeitplanung</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
          <FormControl sx={{ minWidth: '180px' }}>
            <InputLabel id="anbauart-label">Anbauart</InputLabel>
            <Select
              labelId="anbauart-label"
              value={formData.cultivation_type || ''}
              label="Anbauart"
              onChange={e => {
                const val = e.target.value;
                onChange('cultivation_type', val);
                if (val === 'direct_sowing') {
                  onChange('propagation_duration_days', 0);
                }
              }}
            >
              <MenuItem value="">{t('noData')}</MenuItem>
              <MenuItem value="pre_cultivation">Anzucht</MenuItem>
              <MenuItem value="direct_sowing">Direktsaat</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Tooltip title="Wachstumszeitraum = Gesamtzeit von Saat bis Ernte." arrow>
            <TextField
              required
              sx={{ flex: '1 1 22%', minWidth: '150px' }}
              type="number"
              label={t('form.growthDurationDays') + ' *'}
              placeholder={t('form.growthDurationDaysPlaceholder')}
              value={formData.growth_duration_days ?? ''}
              onChange={e => onChange('growth_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
              error={Boolean(errors.growth_duration_days)}
              helperText={errors.growth_duration_days}
              inputProps={{ min: 1, step: 1 }}
            />
          </Tooltip>
          <TextField
            required
            sx={{ flex: '1 1 22%', minWidth: '150px' }}
            type="number"
            label={t('form.harvestDurationDays') + ' *'}
            placeholder={t('form.harvestDurationDaysPlaceholder')}
            value={formData.harvest_duration_days ?? ''}
            onChange={e => onChange('harvest_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
            error={Boolean(errors.harvest_duration_days)}
            helperText={errors.harvest_duration_days}
            inputProps={{ min: 0, step: 1 }}
          />
          <Tooltip title={formData.cultivation_type === 'direct_sowing' ? 'Bei Direktsaat ist keine Anzuchtdauer erforderlich.' : ''} arrow>
            <TextField
              required={formData.cultivation_type !== 'direct_sowing'}
              sx={{ flex: '1 1 22%', minWidth: '150px' }}
              type="number"
              label={"Anzuchtdauer (Tage)" + (formData.cultivation_type !== 'direct_sowing' ? ' *' : '')}
              value={formData.cultivation_type === 'direct_sowing' ? 0 : (formData.propagation_duration_days ?? '')}
              onChange={e => onChange('propagation_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
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
    </>
  );
}
