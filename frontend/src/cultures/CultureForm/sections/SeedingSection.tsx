/**
 * SeedingSection: Saatgutbedarf, Sicherheitszuschlag
 * @remarks Presentational, no internal state
 */
import { Box, Typography, FormControl, InputLabel, Select, MenuItem, TextField, Tooltip } from '@mui/material';
import { FieldWrapper } from '../styles.tsx';
import type { Culture } from '../../../api/types';
import type { TFunction } from 'i18next';

interface SeedingSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function SeedingSection({ formData, errors, onChange, t }: SeedingSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>Saatgut & Aussaat</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl sx={{ flex: '1 1 30%', minWidth: '200px' }}>
          <InputLabel>{t('form.seedingRequirementType', { defaultValue: 'Saatgutbedarf-Typ' })}</InputLabel>
          <Select
            value={formData.seeding_requirement_type || ''}
            label={t('form.seedingRequirementType', { defaultValue: 'Saatgutbedarf-Typ' })}
            onChange={e => onChange('seeding_requirement_type', e.target.value)}
          >
            <MenuItem value="">{t('noData', { defaultValue: 'Keine Angabe' })}</MenuItem>
            <MenuItem value="per_sqm">{t('form.seedingRequirementPerSqm', { defaultValue: 'pro m²' })}</MenuItem>
            <MenuItem value="per_plant">{t('form.seedingRequirementPerPlant', { defaultValue: 'pro Pflanze' })}</MenuItem>
          </Select>
        </FormControl>
        <Tooltip title={t('form.seedingRequirementHelp', { defaultValue: 'Menge pro gewähltem Typ (g, Stück, etc.)' })} arrow>
          <FieldWrapper>
            <TextField
              sx={{ flex: '1 1 30%', minWidth: '200px' }}
              type="number"
              label={t('form.seedingRequirement', { defaultValue: 'Saatgutbedarf' })}
              placeholder={t('form.seedingRequirementPlaceholder', { defaultValue: 'z.B. 0.5' })}
              value={formData.seeding_requirement ?? ''}
              onChange={e => onChange('seeding_requirement', e.target.value ? parseFloat(e.target.value) : undefined)}
              error={Boolean(errors.seeding_requirement)}
              slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
            />
          </FieldWrapper>
        </Tooltip>
        <Tooltip title={t('form.sowingCalculationSafetyPercentHelp', { defaultValue: 'Prozentualer Zuschlag zur berechneten Saatgutmenge.' })} arrow>
          <FieldWrapper>
            <TextField
              sx={{ flex: '1 1 30%', minWidth: '200px', ml: 'auto' }}
              type="number"
              label={t('form.sowingCalculationSafetyPercentLabel', { defaultValue: 'Sicherheitszuschlag für Saatgut (%)' })}
              placeholder={t('form.sowingCalculationSafetyPercentPlaceholder', { defaultValue: 'z.B. 10' })}
              value={formData.sowing_calculation_safety_percent ?? ''}
              onChange={e => onChange('sowing_calculation_safety_percent', e.target.value ? parseFloat(e.target.value) : undefined)}
              error={Boolean(errors.sowing_calculation_safety_percent)}
              slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            />
          </FieldWrapper>
        </Tooltip>
      </Box>
    </>
  );
}
