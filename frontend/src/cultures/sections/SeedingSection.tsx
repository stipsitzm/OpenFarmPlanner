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

function normalizePackageSizeByUnit(sizeValue: number, sizeUnit: SeedPackage['size_unit']): number {
  if (sizeUnit === 'seeds') {
    return Math.round(sizeValue);
  }
  return Math.round(sizeValue * 10) / 10;
}

function SeedRateBlock({
  title,
  valueField,
  unitField,
  safetyField,
  formData,
  errors,
  onChange,
  t,
}: {
  title: string;
  valueField: 'seed_rate_direct_value' | 'seed_rate_pre_cultivation_value';
  unitField: 'seed_rate_direct_unit' | 'seed_rate_pre_cultivation_unit';
  safetyField: 'sowing_calculation_safety_percent_direct' | 'sowing_calculation_safety_percent_pre_cultivation';
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}): React.ReactElement {
  return (
    <>
      <Typography variant="subtitle1" sx={{ mt: 2 }}>{title}</Typography>
      <Box sx={fieldRowSx}>
        <Tooltip title={t('form.seedRateHelp')} arrow>
          <TextField
            sx={fieldSx}
            type="number"
            label={t('form.seedAmountLabel', { defaultValue: 'Menge' })}
            value={formData[valueField] ?? ''}
            onChange={(e) => onChange(valueField, e.target.value ? parseFloat(e.target.value) : null)}
            error={Boolean(errors[valueField])}
            helperText={errors[valueField]}
            slotProps={{ htmlInput: { min: 0.1, step: 0.1 } }}
          />
        </Tooltip>

        <Tooltip title={t('form.seedRateHelp')} arrow>
          <FormControl sx={fieldSx} error={Boolean(errors[unitField])}>
            <InputLabel>{t('form.seedUnitLabel', { defaultValue: 'Einheit' })}</InputLabel>
            <Select
              value={formData[unitField] ?? ''}
              label={t('form.seedUnitLabel', { defaultValue: 'Einheit' })}
              onChange={(e) => onChange(unitField, (e.target.value || null) as Culture[typeof unitField])}
              fullWidth
            >
              <MenuItem value="">-</MenuItem>
              {seedRateUnitOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
            {errors[unitField] && (
              <Typography variant="caption" color="error">{errors[unitField]}</Typography>
            )}
          </FormControl>
        </Tooltip>

        <Tooltip title={t('form.sowingCalculationSafetyPercentHelp', { defaultValue: 'Prozentualer Zuschlag zur berechneten Saatgutmenge.' })} arrow>
          <TextField
            sx={{ ...spacingFieldSx, ml: 'auto' }}
            type="number"
            label={t('form.sowingCalculationSafetyPercentLabel', { defaultValue: 'Sicherheitszuschlag für Saatgut (%)' })}
            value={formData[safetyField] ?? ''}
            onChange={(e) => onChange(safetyField, e.target.value ? parseFloat(e.target.value) : null)}
            error={Boolean(errors[safetyField])}
            helperText={errors[safetyField]}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
          />
        </Tooltip>
      </Box>
    </>
  );
}

export function SeedingSection({ formData, errors, onChange, t }: SeedingSectionProps) {
  const lastPackageSizeInputRef = useRef<HTMLInputElement | null>(null);
  const prevPackageCountRef = useRef<number>(0);
  const packages = formData.seed_packages ?? [];
  const cultivationTypes = formData.cultivation_types ?? (formData.cultivation_type ? [formData.cultivation_type] : []);
  const showsDirect = cultivationTypes.includes('direct_sowing');
  const showsPreCultivation = cultivationTypes.includes('pre_cultivation');

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
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.seedRateSectionTitle', { defaultValue: 'Saatgutbedarf' })}</Typography>

      {showsDirect && (
        <SeedRateBlock
          title={t('form.seedRateDirectSectionTitle', { defaultValue: 'Saatgutbedarf Direktsaat' })}
          valueField="seed_rate_direct_value"
          unitField="seed_rate_direct_unit"
          safetyField="sowing_calculation_safety_percent_direct"
          formData={formData}
          errors={errors}
          onChange={onChange}
          t={t}
        />
      )}

      {showsPreCultivation && (
        <SeedRateBlock
          title={t('form.seedRatePreCultivationSectionTitle', { defaultValue: 'Saatgutbedarf Pflanzung' })}
          valueField="seed_rate_pre_cultivation_value"
          unitField="seed_rate_pre_cultivation_unit"
          safetyField="sowing_calculation_safety_percent_pre_cultivation"
          formData={formData}
          errors={errors}
          onChange={onChange}
          t={t}
        />
      )}

      <Box sx={{ mt: 2 }}>
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
                  min: pkg.size_unit === 'seeds' ? 1 : 0.1,
                  step: 'any',
                  ref: index === packages.length - 1 ? lastPackageSizeInputRef : undefined,
                },
              }}
            />
            <FormControl>
              <InputLabel>{t('form.packageUnitLabel', { defaultValue: 'Packungseinheit' })}</InputLabel>
              <Select
                value={pkg.size_unit}
                label={t('form.packageUnitLabel', { defaultValue: 'Packungseinheit' })}
                onChange={(e) => {
                  const nextSizeUnit = e.target.value as SeedPackage['size_unit'];
                  updatePackage(index, {
                    size_unit: nextSizeUnit,
                    size_value: normalizePackageSizeByUnit(pkg.size_value, nextSizeUnit),
                  });
                }}
              >
                {packageUnitOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title={t('form.deleteSeedPackage', { defaultValue: 'Packung entfernen' })} arrow>
              <IconButton onClick={() => onChange('seed_packages', packages.filter((_item, idx) => idx !== index))} aria-label={t('form.deleteSeedPackage', { defaultValue: 'Packung entfernen' })}><DeleteIcon fontSize="small" /></IconButton>
            </Tooltip>
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
