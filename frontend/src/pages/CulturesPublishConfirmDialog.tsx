import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

type Translator = (key: string, options?: Record<string, unknown>) => string;

type CulturesPublishConfirmDialogProps = {
  open: boolean;
  cultureName: string;
  onClose: () => void;
  onConfirm: () => void;
  t: Translator;
};

/**
 * Presentational confirmation dialog for publishing a culture to the public
 * library. State and the publish handler live in Cultures.tsx.
 */
export function CulturesPublishConfirmDialog({
  open,
  cultureName,
  onClose,
  onConfirm,
  t,
}: CulturesPublishConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ pb: 1 }}>
        {t('library.publishConfirm.title')}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={1.5}>
          <Typography color="text.secondary">
            {t('library.publishConfirm.intro', { name: cultureName })}
          </Typography>
          <Box component="ul" sx={{ mt: 0, mb: 0, pl: 3, color: 'text.secondary' }}>
            <li>{t('library.publishConfirm.published')}</li>
            <li>{t('library.publishConfirm.neverPublished')}</li>
            <li>{t('library.publishConfirm.attribution')}</li>
            <li>{t('library.publishConfirm.persistence')}</li>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t('library.publishConfirm.linkPrefix')}
            <Link component={RouterLink} to="/datenschutz" target="_blank" rel="noopener">
              {t('library.publishConfirm.privacyLinkLabel')}
            </Link>
            {t('library.publishConfirm.linkMiddle')}
            <Link component={RouterLink} to="/nutzungsbedingungen" target="_blank" rel="noopener">
              {t('library.publishConfirm.termsLinkLabel')}
            </Link>
            {t('library.publishConfirm.linkSuffix')}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button variant="outlined" onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>
        <Button variant="contained" onClick={onConfirm}>
          {t('library.publishConfirm.confirmButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
