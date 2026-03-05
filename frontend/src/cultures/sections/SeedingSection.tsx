/**
 * SeedingSection: Saatgutmenge (Menge + Einheit)
 * @remarks Presentational, no internal state
 */
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

export function SeedingSection({ formData, errors, onChange, t }: SeedingSectionProps) {
  const lastPackageSizeInputRef = useRef<HTMLInputElement | null>(null);
  const prevPackageCountRef = useRef<number>(0);

  const selectedCultivationTypes = formData.cultivation_types?.length
    ? formData.cultivation_types
    : (formData.cultivation_type ? [formData.cultivation_type] : []);
  const hasPreCultivation = selectedCultivationTypes.includes('pre_cultivation');
  const hasDirectSowing = selectedCultivationTypes.includes('direct_sowing');
  const hasBothMethods = hasPreCultivation && hasDirectSowing;

  const directSowingUnit = formData.seed_rate_by_cultivation?.direct_sowing?.unit;
  const normalizedDirectSowingUnit: SeedRateUnit = directSowingUnit === 'g_per_m2' || directSowingUnit === 'g_per_lfm'
    ? directSowingUnit
    : 'g_per_lfm';

  const preCultivationUnit = formData.seed_rate_by_cultivation?.pre_cultivation?.unit;
  const normalizedPreCultivationUnit: SeedRateUnit = preCultivationUnit === 'g_per_m2' || preCultivationUnit === 'g_per_lfm'
    ? preCultivationUnit
    : 'g_per_lfm';

  const handleSeedRateUnitChange = (value: string) => {
    if (!value) {
      onChange('seed_rate_unit', null);
      return;
    }
    onChange('seed_rate_unit', value as SeedRateUnit);
  };

  const packages = formData.seed_packages ?? [];


  const parseSizeValue = (value: string): number => {
    if (!value) {
      return 0;
    }
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };

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

  const updateSeedRateByCultivation = (method: 'pre_cultivation' | 'direct_sowing', patch: { value?: number | null; unit?: SeedRateUnit }) => {
    const current = { ...(formData.seed_rate_by_cultivation || {}) };
    const nextMethodValue = {
      ...(current[method] || {}),
      ...patch,
    };
    if (!nextMethodValue.value || nextMethodValue.value <= 0) {
      delete current[method];
    } else {
      current[method] = {
        value: nextMethodValue.value,
        unit: nextMethodValue.unit || 'g_per_lfm',
      };
    }
    onChange('seed_rate_by_cultivation', Object.keys(current).length ? current : null);

  };

  const deletePackage = (index: number) => {
    onChange('seed_packages', packages.filter((_item, idx) => idx !== index));
  };

  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.seedRateSectionTitle', { defaultValue: 'Saatgutmenge' })}</Typography>
      <Box sx={fieldRowSx}>
        {!hasBothMethods && (
          <>
            <Tooltip title={t('form.seedRateHelp')} arrow>
              <TextField
                sx={fieldSx}
                type="number"
                label={hasPreCultivation && !hasDirectSowing ? 'Anzucht Menge (Korn / Pflanze)' : 'Menge'}
                value={formData.seed_rate_value ?? ''}
                onChange={e => onChange('seed_rate_value', e.target.value ? parseFloat(e.target.value) : null)}
                onBlur={() => onChange('seed_rate_value', formData.seed_rate_value)}
                error={Boolean(errors.seed_rate_value)}
                helperText={errors.seed_rate_value}
                slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              />
            </Tooltip>
            {!hasPreCultivation && (
              <Tooltip title={t('form.seedRateHelp')} arrow>
                <FormControl sx={fieldSx} error={Boolean(errors.seed_rate_unit)}>
                  <InputLabel>Einheit</InputLabel>
                  <Select
                    value={
                      hasDirectSowing && (formData.seed_rate_unit === 'g_per_m2' || formData.seed_rate_unit === 'g_per_lfm')
                        ? formData.seed_rate_unit
                        : hasDirectSowing
                          ? 'g_per_lfm'
                          : (formData.seed_rate_unit ?? '')
                    }
                    label="Einheit"
                    onChange={e => handleSeedRateUnitChange(e.target.value)}
                    onBlur={() => onChange('seed_rate_unit', formData.seed_rate_unit)}
                    fullWidth
                  >
                    <MenuItem value="">-</MenuItem>
                    <MenuItem value="g_per_m2">g / m²</MenuItem>
                    <MenuItem value="g_per_lfm">g / lfm</MenuItem>
                  </Select>
                  {errors.seed_rate_unit && (
                    <Typography variant="caption" color="error">{errors.seed_rate_unit}</Typography>
                  )}
                </FormControl>
              </Tooltip>
            )}
          </>
        )}

        {hasPreCultivation && !hasBothMethods && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              sx={fieldSx}
              type="number"
              label="Anzucht Menge"
              value={formData.seed_rate_by_cultivation?.pre_cultivation?.value ?? ''}
              onChange={(e) => updateSeedRateByCultivation('pre_cultivation', { value: e.target.value ? parseFloat(e.target.value) : null, unit: normalizedPreCultivationUnit })}
            />
            <FormControl sx={fieldSx}>
              <InputLabel>Anzucht Einheit</InputLabel>
              <Select
                value={normalizedPreCultivationUnit}
                label="Anzucht Einheit"
                onChange={(e) => updateSeedRateByCultivation('pre_cultivation', { unit: e.target.value as SeedRateUnit, value: formData.seed_rate_by_cultivation?.pre_cultivation?.value ?? null })}
                fullWidth
              >
                <MenuItem value="g_per_m2">g / m²</MenuItem>
                <MenuItem value="g_per_lfm">g / lfm</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}


        {hasBothMethods && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
            <TextField
              sx={{ ...fieldSx, width: '100%' }}
              type="number"
              label="Anzucht Menge (Korn / Pflanze, manuell)"
              value={formData.seed_rate_value ?? ''}
              onChange={e => onChange('seed_rate_value', e.target.value ? parseFloat(e.target.value) : null)}
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                sx={fieldSx}
                type="number"
                label="Anzucht Menge"
                value={formData.seed_rate_by_cultivation?.pre_cultivation?.value ?? ''}
                onChange={(e) => updateSeedRateByCultivation('pre_cultivation', { value: e.target.value ? parseFloat(e.target.value) : null, unit: normalizedPreCultivationUnit })}
              />
              <FormControl sx={fieldSx}>
                <InputLabel>Anzucht Einheit</InputLabel>
                <Select
                  value={normalizedPreCultivationUnit}
                  label="Anzucht Einheit"
                  onChange={(e) => updateSeedRateByCultivation('pre_cultivation', { unit: e.target.value as SeedRateUnit, value: formData.seed_rate_by_cultivation?.pre_cultivation?.value ?? null })}
                  fullWidth
                >
                  <MenuItem value="g_per_m2">g / m²</MenuItem>
                  <MenuItem value="g_per_lfm">g / lfm</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                sx={fieldSx}
                type="number"
                label="Direktsaat Menge"
                value={formData.seed_rate_by_cultivation?.direct_sowing?.value ?? ''}
                onChange={(e) => updateSeedRateByCultivation('direct_sowing', { value: e.target.value ? parseFloat(e.target.value) : null, unit: normalizedDirectSowingUnit })}
              />
              <FormControl sx={fieldSx}>
                <InputLabel>Direktsaat Einheit</InputLabel>
                <Select
                  value={normalizedDirectSowingUnit}
                  label="Direktsaat Einheit"
                  onChange={(e) => updateSeedRateByCultivation('direct_sowing', { unit: e.target.value as SeedRateUnit, value: formData.seed_rate_by_cultivation?.direct_sowing?.value ?? null })}
                  fullWidth
                >
                  <MenuItem value="g_per_m2">g / m²</MenuItem>
                  <MenuItem value="g_per_lfm">g / lfm</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        )}
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

      <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Seed packages</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {packages.map((pkg, index) => (
          <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '180px 40px', gap: 1, alignItems: 'center' }}>
            <TextField
              type="number"
              label="Size (g)"
              value={pkg.size_value}
              onChange={(e) => updatePackage(index, { size_value: parseSizeValue(e.target.value), size_unit: 'g' })}
              error={Boolean(errors[`seed_packages.${index}.size_value`] || errors.seed_packages)}
              helperText={errors[`seed_packages.${index}.size_value`]}
              slotProps={{
                htmlInput: {
                  min: 0.1,
                  step: 0.1,
                  ref: index === packages.length - 1 ? lastPackageSizeInputRef : undefined,
                },
              }}
            />
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
