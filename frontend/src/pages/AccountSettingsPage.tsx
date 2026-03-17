import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n';

export default function AccountSettingsPage(): React.ReactElement {
  const { user, requestAccountDeletion } = useAuth();
  const { t } = useTranslation('account');
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleDelete = async (): Promise<void> => {
    try {
      const response = await requestAccountDeletion(password);
      setDialogOpen(false);
      setInfo(t('deletionScheduled', { date: new Date(response.scheduled_deletion_at).toLocaleString('de-DE') }));
      navigate('/login', { replace: true, state: { deletionScheduled: response.scheduled_deletion_at } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Vormerken der Löschung.');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 760, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 2 }}>{t('title')}</Typography>
      <Typography sx={{ mb: 1 }}><strong>{t('email')}:</strong> {user?.email}</Typography>
      <Typography sx={{ mb: 3 }}><strong>{t('displayName')}:</strong> {user?.display_name || t('noDisplayName')}</Typography>

      <Button color="error" variant="contained" onClick={() => setDialogOpen(true)}>
        {t('deleteButton')}
      </Button>

      {info ? <Alert severity="success" sx={{ mt: 2 }}>{info}</Alert> : null}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('dialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {t('dialogWarning')}
          </Typography>
          <TextField
            fullWidth
            type="password"
            label={t('currentPassword')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('cancel')}</Button>
          <Button color="error" variant="contained" disabled={!password.trim()} onClick={() => void handleDelete()}>
            {t('confirmDelete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
