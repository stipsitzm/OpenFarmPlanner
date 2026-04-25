import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, requestEmailChange, updateProfile } from '../auth/authApi';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../i18n';

export default function AccountSettingsPage(): React.ReactElement {
  const { user, requestAccountDeletion, refreshUser } = useAuth();
  const { t } = useTranslation('account');
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const requiresDeletePhrase = deleteConfirmationText.trim() === 'LÖSCHEN';
  const canDelete = deletePassword.trim().length > 0 && requiresDeletePhrase;

  const handleProfileSave = async (): Promise<void> => {
    setProfileSubmitting(true);
    setProfileMessage(null);
    setProfileError(null);
    try {
      const response = await updateProfile(displayName);
      setProfileMessage(response.detail);
      await refreshUser();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t('errors.generic'));
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handleEmailChangeRequest = async (): Promise<void> => {
    setEmailSubmitting(true);
    setEmailMessage(null);
    setEmailError(null);
    try {
      const response = await requestEmailChange(newEmail, emailPassword);
      setEmailMessage(response.detail);
      setNewEmail('');
      setEmailPassword('');
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : t('errors.generic'));
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handlePasswordChange = async (): Promise<void> => {
    setPasswordSubmitting(true);
    setPasswordMessage(null);
    setPasswordError(null);
    try {
      const response = await changePassword(currentPassword, newPassword, repeatPassword);
      setPasswordMessage(response.detail);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('errors.generic'));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      const response = await requestAccountDeletion(deletePassword);
      setDeleteDialogOpen(false);
      navigate('/login', { replace: true, state: { deletionScheduled: response.scheduled_deletion_at } });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t('errors.delete'));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {t('title')}
      </Typography>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('sections.profile')}
            </Typography>
            <Stack spacing={2}>
              <Typography>
                <strong>{t('email')}:</strong> {user?.email}
              </Typography>
              <Typography>
                <strong>{t('displayName')}:</strong> {user?.display_name || t('noDisplayName')}
              </Typography>
              <TextField
                label={t('displayName')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                fullWidth
                inputProps={{ maxLength: 255 }}
              />
              {profileMessage ? <Alert severity="success">{profileMessage}</Alert> : null}
              {profileError ? <Alert severity="error">{profileError}</Alert> : null}
              <Box>
                <Button variant="contained" onClick={() => void handleProfileSave()} disabled={profileSubmitting}>
                  {t('actions.saveProfile')}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('sections.security')}
            </Typography>

            <Stack spacing={2} sx={{ mb: 3 }}>
              <Typography variant="subtitle1">{t('security.changeEmailTitle')}</Typography>
              <TextField
                label={t('security.newEmail')}
                type="email"
                fullWidth
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
              />
              <TextField
                label={t('currentPassword')}
                type="password"
                fullWidth
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
              />
              {emailMessage ? <Alert severity="success">{emailMessage}</Alert> : null}
              {emailError ? <Alert severity="error">{emailError}</Alert> : null}
              <Box>
                <Button
                  variant="contained"
                  onClick={() => void handleEmailChangeRequest()}
                  disabled={emailSubmitting || !newEmail.trim() || !emailPassword.trim()}
                >
                  {t('actions.requestEmailChange')}
                </Button>
              </Box>
            </Stack>

            <Stack spacing={2}>
              <Typography variant="subtitle1">{t('security.changePasswordTitle')}</Typography>
              <TextField
                label={t('currentPassword')}
                type="password"
                fullWidth
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <TextField
                label={t('security.newPassword')}
                type="password"
                fullWidth
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <TextField
                label={t('security.repeatNewPassword')}
                type="password"
                fullWidth
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
              />
              {passwordMessage ? <Alert severity="success">{passwordMessage}</Alert> : null}
              {passwordError ? <Alert severity="error">{passwordError}</Alert> : null}
              <Box>
                <Button
                  variant="contained"
                  onClick={() => void handlePasswordChange()}
                  disabled={passwordSubmitting || !currentPassword || !newPassword || !repeatPassword}
                >
                  {t('actions.changePassword')}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
          <CardContent>
            <Typography variant="h6" color="error.main" sx={{ mb: 1 }}>
              {t('dangerZone')}
            </Typography>
            <Typography sx={{ mb: 2 }}>{t('deleteDescription')}</Typography>
            <Button color="error" variant="outlined" onClick={() => setDeleteDialogOpen(true)}>
              {t('deleteButton')}
            </Button>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('dialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">{t('dialogWarning')}</Alert>
            <TextField
              fullWidth
              type="password"
              label={t('currentPassword')}
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
            />
            <TextField
              fullWidth
              label={t('deletePhraseLabel')}
              value={deleteConfirmationText}
              onChange={(event) => setDeleteConfirmationText(event.target.value)}
              helperText={t('deletePhraseHelper')}
            />
            {deleteError ? <Alert severity="error">{deleteError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('cancel')}</Button>
          <Button color="error" variant="contained" disabled={!canDelete || deleteSubmitting} onClick={() => void handleDelete()}>
            {t('confirmDelete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
