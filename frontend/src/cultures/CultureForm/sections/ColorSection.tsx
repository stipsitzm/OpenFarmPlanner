/**
 * ColorSection: Display color picker
 * @remarks Presentational, no internal state
 */
import { Typography, TextField } from '@mui/material';
import type { Culture } from '../../../api/types';
import type { TFunction } from 'i18next';


interface ColorSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  defaultColor: string;
}

export function ColorSection({ formData, errors, onChange, t, defaultColor }: ColorSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>Anzeigefarbe</Typography>
      <TextField
        sx={{ maxWidth: '300px' }}
        type="color"
        label={t('form.displayColor')}
        value={formData.display_color || defaultColor}
        onChange={e => onChange('display_color', e.target.value)}
        error={Boolean(errors.display_color)}
        helperText={errors.display_color || t('form.displayColorHelp')}
        slotProps={{ input: { style: { height: '50px' } } }}
      />
    </>
  );
}
