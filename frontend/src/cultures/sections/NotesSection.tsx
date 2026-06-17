import { lazy, Suspense } from 'react';
import { Typography, CircularProgress } from '@mui/material';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';

const RichTextEditor = lazy(() =>
  import('../../components/data-grid/RichTextEditor').then((m) => ({ default: m.RichTextEditor }))
);

interface NotesSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function NotesSection({ formData, onChange, t }: NotesSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.notes')}</Typography>
      <Suspense fallback={<CircularProgress size={24} sx={{ display: 'block', mx: 'auto', mt: 2 }} />}>
        <RichTextEditor
          value={formData.notes ?? ''}
          onChange={(md) => onChange('notes', md as Culture['notes'])}
          autoFocus={false}
        />
      </Suspense>
    </>
  );
}
