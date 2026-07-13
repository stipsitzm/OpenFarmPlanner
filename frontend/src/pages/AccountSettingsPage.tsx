import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword, requestEmailChange, updateProfile } from '../auth/authApi';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../i18n';
import { useNavigationBlocker } from '../hooks/useNavigationBlocker';
import { enableDevOnboardingPreview } from '../projects/devOnboardingPreview';

export default function AccountSettingsPage() {
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
  const [activeEditor, setActiveEditor] = useState<'displayName' | 'email' | 'password' | null>(null);
  const [hintsResetDone, setHintsResetDone] = useState(false);

  const requiresDeletePhrase = deleteConfirmationText.trim() === 'LÖSCHEN';
  const canDelete = deletePassword.trim().length > 0 && requiresDeletePhrase;

  const hasUnsavedChanges = useMemo(() => {
    if (activeEditor === 'displayName') return displayName !== (user?.display_name ?? '');
    if (activeEditor === 'email') return !!newEmail || !!emailPassword;
    if (activeEditor === 'password') return !!currentPassword || !!newPassword || !!repeatPassword;
    return false;
  }, [activeEditor, currentPassword, displayName, emailPassword, newEmail, newPassword, repeatPassword, user?.display_name]);

  useNavigationBlocker(hasUnsavedChanges, t('unsavedChangesWarning'));

  const closeDisplayNameEditor = (): void => {
    setActiveEditor(null);
    setDisplayName(user?.display_name ?? '');
    setProfileError(null);
  };

  const closeEmailEditor = (): void => {
    setActiveEditor(null);
    setNewEmail('');
    setEmailPassword('');
    setEmailError(null);
  };

  const closePasswordEditor = (): void => {
    setActiveEditor(null);
    setCurrentPassword('');
    setNewPassword('');
    setRepeatPassword('');
    setPasswordError(null);
  };

  const handleProfileSave = async (): Promise<void> => {
    setProfileSubmitting(true);
    setProfileMessage(null);
    setProfileError(null);
    try {
      const response = await updateProfile(displayName);
      setProfileMessage(response.detail);
      await refreshUser();
      setActiveEditor(null);
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
      closeEmailEditor();
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
      closePasswordEditor();
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('errors.generic'));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleResetHints = (): void => {
    localStorage.removeItem('ofp.shortcutHintSeen');
    localStorage.removeItem(`ofp.contextMenuHintDismissed:user:${user?.id}`);
    localStorage.removeItem('ofp.contextMenuHintDismissed');
    setHintsResetDone(true);
  };

  const handleShowOnboardingPreview = (): void => {
    enableDevOnboardingPreview();
    localStorage.removeItem('activeProjectId');
    navigate('/app/project-selection');
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
              {profileMessage ? <Alert severity="success">{profileMessage}</Alert> : null}
              {profileError ? <Alert severity="error">{profileError}</Alert> : null}
              <Box>
                {activeEditor !== 'displayName' ? (
                  <Button
                    variant="outlined"
                    onClick={() => setActiveEditor('displayName')}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    {t('actions.editDisplayName')}
                  </Button>
                ) : null}
              </Box>
              <Collapse in={activeEditor === 'displayName'} unmountOnExit>
                <Stack spacing={2}>
                  <TextField
                    label={t('displayName')}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 255 } }}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button
                      variant="contained"
                      onClick={() => void handleProfileSave()}
                      disabled={profileSubmitting}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      {t('actions.save')}
                    </Button>
                    <Button
                      variant="text"
                      onClick={closeDisplayNameEditor}
                      disabled={profileSubmitting}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      {t('cancel')}
                    </Button>
                  </Stack>
                </Stack>
              </Collapse>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t('sections.security')}
            </Typography>

            {emailMessage ? <Alert severity="success">{emailMessage}</Alert> : null}
            {passwordMessage ? <Alert severity="success">{passwordMessage}</Alert> : null}
            {emailError ? <Alert severity="error">{emailError}</Alert> : null}
            {passwordError ? <Alert severity="error">{passwordError}</Alert> : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
              <Button
                variant={activeEditor === 'email' ? 'contained' : 'outlined'}
                onClick={() => setActiveEditor('email')}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {t('security.changeEmailTitle')}
              </Button>
              <Button
                variant={activeEditor === 'password' ? 'contained' : 'outlined'}
                onClick={() => setActiveEditor('password')}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {t('security.changePasswordTitle')}
              </Button>
            </Stack>

            <Collapse in={activeEditor === 'email'} unmountOnExit>
              <Stack spacing={2} sx={{ mb: 2 }}>
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
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    variant="contained"
                    onClick={() => void handleEmailChangeRequest()}
                    disabled={emailSubmitting || !newEmail.trim() || !emailPassword.trim()}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    {t('actions.sendConfirmationLink')}
                  </Button>
                  <Button
                    variant="text"
                    onClick={closeEmailEditor}
                    disabled={emailSubmitting}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    {t('cancel')}
                  </Button>
                </Stack>
              </Stack>
            </Collapse>

            <Collapse in={activeEditor === 'password'} unmountOnExit>
              <Stack spacing={2}>
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
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    variant="contained"
                    onClick={() => void handlePasswordChange()}
                    disabled={passwordSubmitting || !currentPassword || !newPassword || !repeatPassword}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    {t('actions.savePassword')}
                  </Button>
                  <Button
                    variant="text"
                    onClick={closePasswordEditor}
                    disabled={passwordSubmitting}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    {t('cancel')}
                  </Button>
                </Stack>
              </Stack>
            </Collapse>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {t('sections.account')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Button color="error" variant="outlined" onClick={() => setDeleteDialogOpen(true)}>
              {t('deleteButton')}
            </Button>
          </CardContent>
        </Card>

        {import.meta.env.DEV ? (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>{t('developer.title')}</Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('developer.hintsDescription')}
              </Typography>
              {hintsResetDone ? <Alert severity="success" sx={{ mb: 2 }}>{t('developer.hintsResetDone')}</Alert> : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button variant="outlined" onClick={handleResetHints}>
                  {t('developer.resetHintsAction')}
                </Button>
                <Button variant="outlined" onClick={handleShowOnboardingPreview}>
                  {t('developer.showOnboardingAction')}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('dialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">{t('dialogWarning')}</Alert>
            <Typography>{t('deleteDescription')}</Typography>
            <Typography>{t('restoreDescription')}</Typography>
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
