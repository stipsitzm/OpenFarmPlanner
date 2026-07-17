import type { FormEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';

import { useTranslation } from '../i18n';

interface CreateProjectDialogProps {
  open: boolean;
  name: string;
  onNameChange: (value: string) => void;
  isCreating: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/**
 * Presentational create-project dialog. The draft name, submit handler and
 * open state live in RootLayout.tsx; this component only renders the form.
 */
export function CreateProjectDialog({
  open,
  name,
  onNameChange,
  isCreating,
  onClose,
  onSubmit,
}: CreateProjectDialogProps) {
  const { t } = useTranslation('navigation');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={onSubmit}>
        <DialogTitle>{t('projectSwitcher.createDialogTitle')}</DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 1 }}>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              label={t('projectSwitcher.createNameLabel')}
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              autoFocus
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose}>{t('projectSwitcher.createCancel')}</Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || isCreating}>
            {t('projectSwitcher.createSubmit')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
