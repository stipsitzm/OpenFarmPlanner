/**
 * SpacingSection: Planting distances (Abstände, Saattiefe)
 * @remarks Presentational, no internal state
 */
import { Box, Typography, TextField } from '@mui/material';
import type { Culture } from '../../../api/types';
import type { TFunction } from 'i18next';
import { FieldWrapper, spacingFieldSx } from '../styles.tsx';

interface SpacingSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function SpacingSection({ formData, errors, onChange, t }: SpacingSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>Pflanzabstände</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          sx={spacingFieldSx}
          type="number"
          label={t('form.distanceWithinRowCm', { defaultValue: 'Abstand in der Reihe (cm)' })}
          placeholder={t('form.distanceWithinRowCmPlaceholder', { defaultValue: 'z.B. 25' })}
          value={formData.distance_within_row_cm ?? ''}
          onChange={e => onChange('distance_within_row_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
          error={Boolean(errors.distance_within_row_cm)}
          helperText={errors.distance_within_row_cm}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        <TextField
          sx={spacingFieldSx}
          type="number"
          label={t('form.rowSpacingCm', { defaultValue: 'Reihenabstand (cm)' })}
          placeholder={t('form.rowSpacingCmPlaceholder', { defaultValue: 'z.B. 40' })}
          value={formData.row_spacing_cm ?? ''}
          onChange={e => onChange('row_spacing_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
          error={Boolean(errors.row_spacing_cm)}
          helperText={errors.row_spacing_cm}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
        <TextField
          sx={spacingFieldSx}
          type="number"
          label={t('form.sowingDepthCm', { defaultValue: 'Saattiefe (cm)' })}
          placeholder={t('form.sowingDepthCmPlaceholder', { defaultValue: 'z.B. 2' })}
          value={formData.sowing_depth_cm ?? ''}
          onChange={e => onChange('sowing_depth_cm', e.target.value ? parseFloat(e.target.value) : undefined)}
          error={Boolean(errors.sowing_depth_cm)}
          helperText={errors.sowing_depth_cm}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
      </Box>
    </>
  );
}
