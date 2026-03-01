/**
 * SeedingSection: Saatgutmenge (Menge + Einheit)
 * @remarks Presentational, no internal state
 */
import { Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Tooltip, Checkbox, IconButton, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Culture, SeedPackage, SeedRateUnit } from '../../api/types';
import type { TFunction } from 'i18next';
import { fieldSx, spacingFieldSx } from './styles.tsx';
import { fieldRowSx } from './styles.tsx';

interface SeedingSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function SeedingSection({ formData, errors, onChange, t }: SeedingSectionProps) {
  const handleSeedRateUnitChange = (value: string) => {
    if (!value) {
      onChange('seed_rate_unit', null);
      return;
    }
    onChange('seed_rate_unit', value as SeedRateUnit);
  };

  const packages = formData.seed_packages ?? [];

  const updatePackage = (index: number, patch: Partial<SeedPackage>) => {
    const next = packages.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
    onChange('seed_packages', next);
  };

  const addPackage = () => {
    onChange('seed_packages', [...packages, { size_value: 0, available: true }]);
  };

  const deletePackage = (index: number) => {
    onChange('seed_packages', packages.filter((_item, idx) => idx !== index));
  };

  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.seedRateSectionTitle', { defaultValue: 'Saatgutmenge' })}</Typography>
      <Box sx={fieldRowSx}>
        <Tooltip title={t('form.seedRateHelp')} arrow>
          <TextField
            sx={fieldSx}
            type="number"
            label="Menge"
            value={formData.seed_rate_value ?? ''}
            onChange={e => onChange('seed_rate_value', e.target.value ? parseFloat(e.target.value) : null)}
            onBlur={() => onChange('seed_rate_value', formData.seed_rate_value)}
            error={Boolean(errors.seed_rate_value)}
            helperText={errors.seed_rate_value}
            slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
          />
        </Tooltip>
        <Tooltip title={t('form.seedRateHelp')} arrow>
          <FormControl sx={fieldSx} error={Boolean(errors.seed_rate_unit)}>
            <InputLabel>Einheit</InputLabel>
            <Select
              value={formData.seed_rate_unit ?? ''}
              label="Einheit"
              onChange={e => handleSeedRateUnitChange(e.target.value)}
              onBlur={() => onChange('seed_rate_unit', formData.seed_rate_unit)}
              fullWidth
            >
              <MenuItem value="">-</MenuItem>
              <MenuItem value="g_per_m2">g / m²</MenuItem>
              <MenuItem value="seeds/m">Korn / lfm</MenuItem>
              <MenuItem value="seeds_per_plant">Korn / Pflanze</MenuItem>
            </Select>
            {errors.seed_rate_unit && (
              <Typography variant="caption" color="error">{errors.seed_rate_unit}</Typography>
            )}
          </FormControl>
        </Tooltip>
        <Tooltip title={t('form.thousandKernelWeightHelp', { defaultValue: 'Gewicht von 1000 Körnern in Gramm.' })} arrow>
          <TextField
            sx={fieldSx}
            type="number"
            label={t('form.thousandKernelWeightLabel', { defaultValue: 'Tausendkorngewicht (g)' })}
            value={formData.thousand_kernel_weight_g ?? ''}
            onChange={e => onChange('thousand_kernel_weight_g', e.target.value ? parseFloat(e.target.value) : undefined)}
            error={Boolean(errors.thousand_kernel_weight_g)}
            helperText={errors.thousand_kernel_weight_g}
            slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
          />
        </Tooltip>
        <Tooltip title={t('form.sowingCalculationSafetyPercentHelp', { defaultValue: 'Prozentualer Zuschlag zur berechneten Saatgutmenge.' })} arrow>
          <TextField
            sx={{ ...spacingFieldSx, ml: 'auto' }}
            type="number"
            label={t('form.sowingCalculationSafetyPercentLabel', { defaultValue: 'Sicherheitszuschlag für Saatgut (%)' })}
            placeholder={t('form.sowingCalculationSafetyPercentPlaceholder', { defaultValue: 'z.B. 10' })}
            value={formData.sowing_calculation_safety_percent ?? ''}
            onChange={e => onChange('sowing_calculation_safety_percent', e.target.value ? parseFloat(e.target.value) : undefined)}
            error={Boolean(errors.sowing_calculation_safety_percent)}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
          />
        </Tooltip>
      </Box>

      <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Seed packages (in grams)</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {packages.map((pkg, index) => (
          <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '150px 150px 40px', gap: 1, alignItems: 'center' }}>
            <TextField
              type="number"
              label="Size (g)"
              value={pkg.size_value}
              onChange={(e) => updatePackage(index, { size_value: e.target.value ? parseFloat(e.target.value) : 0 })}
              error={Boolean(errors[`seed_packages.${index}.size_value`] || errors.seed_packages)}
              helperText={errors[`seed_packages.${index}.size_value`]}
              slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox checked={pkg.available} onChange={(e) => updatePackage(index, { available: e.target.checked })} />
              <Typography variant="body2">available</Typography>
            </Box>
            <IconButton onClick={() => deletePackage(index)} aria-label="delete-seed-package"><DeleteIcon fontSize="small" /></IconButton>
          </Box>
        ))}
        {errors.seed_packages && <Typography variant="caption" color="error">{errors.seed_packages}</Typography>}
        <Box>
          <Button type="button" onClick={addPackage} variant="outlined" size="small">Add pack</Button>
        </Box>
      </Box>
    </>
  );
}
