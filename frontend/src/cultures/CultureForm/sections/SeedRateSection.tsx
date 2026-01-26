/**
 * SeedRateSection: Saatgutmenge (Menge + Einheit)
 * @remarks Presentational, no internal state
 */
import { Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import type { Culture } from '../../../api/types';

interface SeedRateSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
}

export function SeedRateSection({ formData, errors, onChange }: SeedRateSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>Saatgutmenge (Aussaatstärke)</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField
          sx={{ flex: '1 1 30%', minWidth: '160px' }}
          type="number"
          label="Menge"
          value={formData.seed_rate_value ?? ''}
          onChange={e => onChange('seed_rate_value', e.target.value ? parseFloat(e.target.value) : null)}
          onBlur={() => onChange('seed_rate_value', formData.seed_rate_value)}
          error={Boolean(errors.seed_rate_value)}
          helperText={errors.seed_rate_value || 'Wenn eine Menge angegeben wird, muss auch eine Einheit gewählt werden.'}
          inputProps={{ min: 0, step: 0.01 }}
        />
        <FormControl sx={{ flex: '1 1 30%', minWidth: '180px' }} error={Boolean(errors.seed_rate_unit)}>
          <InputLabel>Einheit</InputLabel>
          <Select
            value={formData.seed_rate_unit ?? ''}
            label="Einheit"
            onChange={e => onChange('seed_rate_unit', e.target.value)}
            onBlur={() => onChange('seed_rate_unit', formData.seed_rate_unit)}
          >
            <MenuItem value="">-</MenuItem>
            <MenuItem value="g_per_m2">g / m²</MenuItem>
            <MenuItem value="pcs_per_m2">Stück / m²</MenuItem>
            <MenuItem value="pcs_per_plant">Stück / Pflanze</MenuItem>
          </Select>
          {errors.seed_rate_unit && (
            <Typography variant="caption" color="error">{errors.seed_rate_unit}</Typography>
          )}
        </FormControl>
      </Box>
    </>
  );
}
