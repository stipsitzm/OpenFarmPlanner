import { useEffect, useRef } from 'react';
import { Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem, Tooltip, IconButton, Button } from '@mui/material';
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

const seedRateUnitOptions: Array<{ value: SeedRateUnit; label: string }> = [
  { value: 'g_per_m2', label: 'g / m²' },
  { value: 'g_per_lfm', label: 'g / lfm' },
  { value: 'seeds_per_m2', label: 'Korn / m²' },
  { value: 'seeds_per_lfm', label: 'Korn / lfm' },
  { value: 'seeds_per_plant', label: 'Korn / Pflanze' },
];

const packageUnitOptions: Array<{ value: 'g' | 'seeds'; label: string }> = [
  { value: 'g', label: 'g' },
  { value: 'seeds', label: 'Korn' },
];

function parseNumeric(value: string): number {
  if (!value) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SeedingSection({ formData, errors, onChange, t }: SeedingSectionProps) {
  const lastPackageSizeInputRef = useRef<HTMLInputElement | null>(null);
  const prevPackageCountRef = useRef<number>(0);
  const packages = formData.seed_packages ?? [];

  useEffect(() => {
    if (packages.length > prevPackageCountRef.current && lastPackageSizeInputRef.current) {
      lastPackageSizeInputRef.current.focus();
      lastPackageSizeInputRef.current.select();
    }
    prevPackageCountRef.current = packages.length;
  }, [packages.length]);

  const updatePackage = (index: number, patch: Partial<SeedPackage>) => {
    const next = packages.map((item, idx) => (idx === index ? { ...item, ...patch } : item));
    onChange('seed_packages', next);
  };

  const addPackage = () => {
    onChange('seed_packages', [...packages, { size_value: 0, size_unit: 'g' }]);
  };

  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.seedRateSectionTitle', { defaultValue: 'Saatgutmenge' })}</Typography>
      <Box sx={fieldRowSx}>
        <Tooltip title={t('form.seedRateHelp')} arrow>
          <TextField
            sx={fieldSx}
            type="number"
            label={t('form.seedRateValue', { defaultValue: 'Saatgutmenge' })}
            value={formData.seed_rate_value ?? ''}
            onChange={e => onChange('seed_rate_value', e.target.value ? parseFloat(e.target.value) : null)}
            onBlur={() => onChange('seed_rate_value', formData.seed_rate_value)}
            error={Boolean(errors.seed_rate_value)}
            helperText={errors.seed_rate_value}
            slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
          />
        </Tooltip>

        <Tooltip title={t('form.seedRateHelp')} arrow>
          <FormControl sx={fieldSx} error={Boolean(errors.seed_rate_unit)}>
            <InputLabel>{t('form.seedRateUnit', { defaultValue: 'Einheit der Saatgutmenge' })}</InputLabel>
            <Select
              value={formData.seed_rate_unit ?? ''}
              label={t('form.seedRateUnit', { defaultValue: 'Einheit der Saatgutmenge' })}
              onChange={e => onChange('seed_rate_unit', (e.target.value || null) as Culture['seed_rate_unit'])}
              fullWidth
            >
              <MenuItem value="">-</MenuItem>
              {seedRateUnitOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
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
            slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
          />
        </Tooltip>

        <Tooltip title={t('form.sowingCalculationSafetyPercentHelp', { defaultValue: 'Prozentualer Zuschlag zur berechneten Saatgutmenge.' })} arrow>
          <TextField
            sx={{ ...spacingFieldSx, ml: 'auto' }}
            type="number"
            label={t('form.sowingCalculationSafetyPercentLabel', { defaultValue: 'Sicherheitszuschlag für Saatgut (%)' })}
            value={formData.sowing_calculation_safety_percent ?? ''}
            onChange={e => onChange('sowing_calculation_safety_percent', e.target.value ? parseFloat(e.target.value) : undefined)}
            error={Boolean(errors.sowing_calculation_safety_percent)}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
          />
        </Tooltip>
      </Box>

      <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
        {t('form.seedPackagesLabel', { defaultValue: 'Packungsgrößen' })}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {packages.map((pkg, index) => (
          <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '180px 160px 40px', gap: 1, alignItems: 'center' }}>
            <TextField
              type="number"
              label={t('form.packageSizeLabel', { defaultValue: 'Packungsgröße' })}
              value={pkg.size_value}
              onChange={(e) => updatePackage(index, { size_value: parseNumeric(e.target.value) })}
              error={Boolean(errors[`seed_packages.${index}.size_value`] || errors.seed_packages)}
              helperText={errors[`seed_packages.${index}.size_value`]}
              slotProps={{
                htmlInput: {
                  min: 0.1,
                  step: pkg.size_unit === 'seeds' ? 1 : 0.1,
                  ref: index === packages.length - 1 ? lastPackageSizeInputRef : undefined,
                },
              }}
            />
            <FormControl>
              <InputLabel>{t('form.packageUnitLabel', { defaultValue: 'Packungseinheit' })}</InputLabel>
              <Select
                value={pkg.size_unit}
                label={t('form.packageUnitLabel', { defaultValue: 'Packungseinheit' })}
                onChange={(e) => updatePackage(index, { size_unit: e.target.value as SeedPackage['size_unit'] })}
              >
                {packageUnitOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton onClick={() => onChange('seed_packages', packages.filter((_item, idx) => idx !== index))} aria-label="delete-seed-package"><DeleteIcon fontSize="small" /></IconButton>
          </Box>
        ))}
        {errors.seed_packages && <Typography variant="caption" color="error">{errors.seed_packages}</Typography>}
        <Box>
          <Button type="button" onClick={addPackage} variant="outlined" size="small">
            {t('form.addSeedPackage', { defaultValue: 'Packung hinzufügen' })}
          </Button>
        </Box>
      </Box>
    </>
  );
}
