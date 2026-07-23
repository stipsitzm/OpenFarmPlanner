import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { Culture } from '../api/types';
import { BasicInfoSection } from './sections/BasicInfoSection';
import { TimingSection } from './sections/TimingSection';
import { HarvestSection } from './sections/HarvestSection';
import { SpacingSection } from './sections/SpacingSection';
import { SeedingSection } from './sections/SeedingSection';
import { ColorSection } from './sections/ColorSection';
import { NotesSection } from './sections/NotesSection';

export const DEFAULT_CULTURE_DISPLAY_COLOR = '#3498db';

interface CultureFormSectionsProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  identityHint?: ReactNode;
  extraAfterNotes?: ReactNode;
  defaultColor?: string;
}

export function CultureFormSections({
  formData,
  errors,
  onChange,
  t,
  identityHint,
  extraAfterNotes,
  defaultColor = DEFAULT_CULTURE_DISPLAY_COLOR,
}: CultureFormSectionsProps) {
  return (
    <>
      <Typography variant="h6">{t('form.generalInfoSectionTitle')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('form.generalInfoSectionDescription')}
      </Typography>
      <BasicInfoSection
        formData={formData}
        errors={errors}
        onChange={onChange}
        t={t}
        identityHint={identityHint}
      />
      <TimingSection formData={formData} errors={errors} onChange={onChange} t={t} />
      <HarvestSection formData={formData} errors={errors} onChange={onChange} t={t} />
      <SpacingSection formData={formData} errors={errors} onChange={onChange} t={t} />
      <SeedingSection formData={formData} errors={errors} onChange={onChange} t={t} />
      <ColorSection formData={formData} errors={errors} onChange={onChange} t={t} defaultColor={defaultColor} />
      <NotesSection formData={formData} onChange={onChange} t={t} errors={errors} />
      {extraAfterNotes ? <Box>{extraAfterNotes}</Box> : null}
    </>
  );
}
