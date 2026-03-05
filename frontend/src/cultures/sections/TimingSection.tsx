/**
 * TimingSection: Cultivation type, growth/harvest/propagation durations
 * @remarks Presentational, no internal state
 */
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, TextField, Tooltip, Checkbox, ListItemText } from '@mui/material';
import { smallFieldSx } from './styles.tsx';
import type { Culture, CultivationType } from '../../api/types';
import type { TFunction } from 'i18next';

interface TimingSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function TimingSection({ formData, errors, onChange, t }: TimingSectionProps) {
  const selectedCultivationTypes = formData.cultivation_types?.length
    ? formData.cultivation_types
    : (formData.cultivation_type ? [formData.cultivation_type as CultivationType] : []);

  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>Zeitplanung</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
          <FormControl sx={{ minWidth: '180px' }}>
            <InputLabel id="anbauart-label">Anbauart</InputLabel>
            <Select
              labelId="anbauart-label"
              multiple
              value={selectedCultivationTypes}
              label="Anbauart"
              onChange={e => {
                const values = (e.target.value as CultivationType[]).filter(Boolean);
                onChange('cultivation_types', values);
                onChange('cultivation_type', values[0] || 'pre_cultivation');
                if (values.length === 1 && values[0] === 'direct_sowing') {
                  onChange('propagation_duration_days', 0);
                }
              }}
              renderValue={(selected) => {
                const values = selected as CultivationType[];
                return values
                  .map((item) => item === 'pre_cultivation' ? 'Pflanzung' : 'Direktsaat')
                  .join(', ');
              }}
            >
              <MenuItem value="pre_cultivation">
                <Checkbox checked={selectedCultivationTypes.includes('pre_cultivation')} />
                <ListItemText primary="Pflanzung" />
              </MenuItem>
              <MenuItem value="direct_sowing">
                <Checkbox checked={selectedCultivationTypes.includes('direct_sowing')} />
                <ListItemText primary="Direktsaat" />
              </MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Tooltip title="Wachstumszeitraum = Gesamtzeit von Saat bis Ernte." arrow>
            <TextField
              sx={smallFieldSx}
              type="number"
              label={t('form.growthDurationDays')}
              placeholder={t('form.growthDurationDaysPlaceholder')}
              value={formData.growth_duration_days ?? ''}
              onChange={e => onChange('growth_duration_days', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
              error={Boolean(errors.growth_duration_days)}
              helperText={errors.growth_duration_days}
              inputProps={{ min: 1, step: 1 }}
            />
          </Tooltip>
          <TextField
            sx={smallFieldSx}
            type="number"
            label={t('form.harvestDurationDays')}
            placeholder={t('form.harvestDurationDaysPlaceholder')}
            value={formData.harvest_duration_days ?? ''}
            onChange={e => onChange('harvest_duration_days', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
            error={Boolean(errors.harvest_duration_days)}
            helperText={errors.harvest_duration_days}
            inputProps={{ min: 0, step: 1 }}
          />
          <Tooltip title={(selectedCultivationTypes.length === 1 && selectedCultivationTypes[0] === 'direct_sowing') ? 'Bei Direktsaat ist keine Anzuchtdauer erforderlich.' : ''} arrow>
            <TextField
              sx={smallFieldSx}
              type="number"
              label="Anzuchtdauer (Tage)"
              value={(selectedCultivationTypes.length === 1 && selectedCultivationTypes[0] === 'direct_sowing') ? 0 : (formData.propagation_duration_days ?? '')}
              onChange={e => onChange('propagation_duration_days', e.target.value ? parseInt(e.target.value) : undefined)}
              disabled={selectedCultivationTypes.length === 1 && selectedCultivationTypes[0] === 'direct_sowing'}
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
