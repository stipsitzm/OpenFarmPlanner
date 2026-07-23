/**
 * ColorSection: Display color picker
 * @remarks Presentational, no internal state
 */
import { Stack, Typography, TextField } from '@mui/material';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';
import { fieldRowSx, smallFieldSx } from './styles.tsx';


interface ColorSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  defaultColor: string;
}

function isValidDisplayColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function ColorSection({ formData, errors, onChange, t, defaultColor }: ColorSectionProps) {
  const displayColor = formData.display_color || defaultColor;
  const pickerColor = isValidDisplayColor(displayColor) ? displayColor : defaultColor;

  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.displayColor')}</Typography>
      <Stack sx={fieldRowSx}>
        <TextField
          sx={{
            width: { xs: 112, sm: 112 },
            maxWidth: { xs: 112, sm: 112 },
            flex: '0 0 112px',
            '& .MuiOutlinedInput-root': {
              height: 56,
              p: 0.75,
            },
            '& input[type="color"]': {
              width: '100%',
              height: 40,
              p: 0,
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
            },
            '& input[type="color"]::-webkit-color-swatch-wrapper': {
              p: 0,
            },
            '& input[type="color"]::-webkit-color-swatch': {
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 0.75,
            },
            '& input[type="color"]::-moz-color-swatch': {
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 0.75,
            },
          }}
          type="color"
          label={t('form.displayColor')}
          value={pickerColor}
          onChange={e => onChange('display_color', e.target.value)}
          error={Boolean(errors.display_color)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          sx={smallFieldSx}
          label={t('form.displayColorValue')}
          value={displayColor}
          onChange={e => onChange('display_color', e.target.value)}
          error={Boolean(errors.display_color)}
          helperText={errors.display_color || t('form.displayColorHelp')}
          slotProps={{ htmlInput: { maxLength: 7 } }}
        />
      </Stack>
    </>
  );
}
