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
  type SxProps,
  type Theme,
} from '@mui/material';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  changePassword,
  getAccountDataExport,
  requestEmailChange,
  updateProfile,
  updatePublicDisplayName,
} from '../auth/authApi';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../i18n';
import { useNavigationBlocker } from '../hooks/useNavigationBlocker';
import { enableDevOnboardingPreview } from '../projects/devOnboardingPreview';
import { clearContextMenuHintDismissals } from '../components/data-grid';
import { mediumFieldSx, wideFieldSx } from '../components/forms/formLayout';

const actionButtonSx = { width: { xs: '100%', sm: 'auto' } } as const;

interface SectionSubmit {
  message: string | null;
  error: string | null;
  submitting: boolean;
  submit: (action: () => Promise<{ detail: string }>, onSuccess?: () => void | Promise<void>) => Promise<void>;
  clearError: () => void;
}

function useSectionSubmit(genericErrorMessage: string): SectionSubmit {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (
    action: () => Promise<{ detail: string }>,
    onSuccess?: () => void | Promise<void>,
  ): Promise<void> => {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await action();
      setMessage(response.detail);
      await onSuccess?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : genericErrorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return { message, error, submitting, submit, clearError: () => setError(null) };
}

function SectionAlerts({ message, error }: Pick<SectionSubmit, 'message' | 'error'>) {
  return (
    <>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </>
  );
}

interface InlineEditorProps {
  open: boolean;
  saveLabel: ReactNode;
  onSave: () => void;
  onCancel: () => void;
  submitting: boolean;
  saveDisabled?: boolean;
  sx?: SxProps<Theme>;
  children: ReactNode;
}

function InlineEditor({ open, saveLabel, onSave, onCancel, submitting, saveDisabled = false, sx, children }: InlineEditorProps) {
  const { t } = useTranslation('account');
  return (
    <Collapse in={open} unmountOnExit>
      <Stack spacing={2} sx={sx}>
        {children}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" onClick={onSave} disabled={submitting || saveDisabled} sx={actionButtonSx}>
            {saveLabel}
          </Button>
          <Button variant="text" onClick={onCancel} disabled={submitting} sx={actionButtonSx}>
            {t('cancel')}
          </Button>
        </Stack>
      </Stack>
    </Collapse>
  );
}

interface SettingsCardProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: description ? 0.5 : 2 }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

export default function AccountSettingsPage() {
  const { user, requestAccountDeletion, refreshUser } = useAuth();
  const { t } = useTranslation('account');
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [publicDisplayName, setPublicDisplayName] = useState(user?.public_display_name ?? '');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  const profileSection = useSectionSubmit(t('errors.generic'));
  const publicProfileSection = useSectionSubmit(t('errors.generic'));
  const emailSection = useSectionSubmit(t('errors.generic'));
  const passwordSection = useSectionSubmit(t('errors.generic'));
  const dataExportSection = useSectionSubmit(t('errors.generic'));

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [activeEditor, setActiveEditor] = useState<'displayName' | 'publicDisplayName' | 'email' | 'password' | null>(null);
  const [hintsResetDone, setHintsResetDone] = useState(false);

  const deletePhrase = t('deletePhrase');
  const requiresDeletePhrase = deleteConfirmationText.trim() === deletePhrase;
  const canDelete = deletePassword.trim().length > 0 && requiresDeletePhrase;

  const hasUnsavedChanges = useMemo(() => {
    if (activeEditor === 'displayName') return displayName !== (user?.display_name ?? '');
    if (activeEditor === 'publicDisplayName') return publicDisplayName !== (user?.public_display_name ?? '');
    if (activeEditor === 'email') return !!newEmail || !!emailPassword;
    if (activeEditor === 'password') return !!currentPassword || !!newPassword || !!repeatPassword;
    return false;
  }, [
    activeEditor,
    currentPassword,
    displayName,
    emailPassword,
    newEmail,
    newPassword,
    publicDisplayName,
    repeatPassword,
    user?.display_name,
    user?.public_display_name,
  ]);

  useNavigationBlocker(hasUnsavedChanges, t('unsavedChangesWarning'));

  const closeDisplayNameEditor = (): void => {
    setActiveEditor(null);
    setDisplayName(user?.display_name ?? '');
    profileSection.clearError();
  };

  const closePublicDisplayNameEditor = (): void => {
    setActiveEditor(null);
    setPublicDisplayName(user?.public_display_name ?? '');
    publicProfileSection.clearError();
  };

  const closeEmailEditor = (): void => {
    setActiveEditor(null);
    setNewEmail('');
    setEmailPassword('');
    emailSection.clearError();
  };

  const closePasswordEditor = (): void => {
    setActiveEditor(null);
    setCurrentPassword('');
    setNewPassword('');
    setRepeatPassword('');
    passwordSection.clearError();
  };

  const handleProfileSave = (): Promise<void> =>
    profileSection.submit(
      () => updateProfile(displayName),
      async () => {
        await refreshUser();
        setActiveEditor(null);
      },
    );

  const handlePublicProfileSave = (): Promise<void> =>
    publicProfileSection.submit(
      () => updatePublicDisplayName(publicDisplayName),
      async () => {
        await refreshUser();
        setActiveEditor(null);
      },
    );

  const handleEmailChangeRequest = (): Promise<void> =>
    emailSection.submit(() => requestEmailChange(newEmail, emailPassword), closeEmailEditor);

  const handlePasswordChange = (): Promise<void> =>
    passwordSection.submit(() => changePassword(currentPassword, newPassword, repeatPassword), closePasswordEditor);

  const handleDataExport = (): Promise<void> =>
    dataExportSection.submit(async () => {
      const payload = await getAccountDataExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'openfarmplanner-data-export.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return { detail: t('dataExport.success') };
    });

  const handleResetHints = (): void => {
    localStorage.removeItem('ofp.shortcutHintSeen');
    clearContextMenuHintDismissals(user?.id);
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
        <SettingsCard title={t('sections.profile')}>
          <Stack spacing={2}>
            <Typography>
              <strong>{t('email')}:</strong> {user?.email}
            </Typography>
            <Typography>
              <strong>{t('displayName')}:</strong> {user?.display_name || t('noDisplayName')}
            </Typography>
            <SectionAlerts message={profileSection.message} error={profileSection.error} />
            <Box>
              {activeEditor !== 'displayName' ? (
                <Button variant="outlined" onClick={() => setActiveEditor('displayName')} sx={actionButtonSx}>
                  {t('actions.editDisplayName')}
                </Button>
              ) : null}
            </Box>
            <InlineEditor
              open={activeEditor === 'displayName'}
              saveLabel={t('actions.save')}
              onSave={() => void handleProfileSave()}
              onCancel={closeDisplayNameEditor}
              submitting={profileSection.submitting}
            >
              <TextField
                label={t('displayName')}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                sx={wideFieldSx}
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
            </InlineEditor>

            <Divider />

            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('sections.publicProfile')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('publicProfile.description')}
            </Typography>
            <Typography>
              <strong>{t('publicProfile.publicDisplayName')}:</strong>{' '}
              {user?.public_display_name || t('publicProfile.noPublicDisplayName')}
            </Typography>
            <SectionAlerts message={publicProfileSection.message} error={publicProfileSection.error} />
            <Box>
              {activeEditor !== 'publicDisplayName' ? (
                <Button variant="outlined" onClick={() => setActiveEditor('publicDisplayName')} sx={actionButtonSx}>
                  {user?.public_display_name
                    ? t('publicProfile.actions.editPublicDisplayName')
                    : t('publicProfile.actions.setPublicDisplayName')}
                </Button>
              ) : null}
            </Box>
            <InlineEditor
              open={activeEditor === 'publicDisplayName'}
              saveLabel={t('actions.save')}
              onSave={() => void handlePublicProfileSave()}
              onCancel={closePublicDisplayNameEditor}
              submitting={publicProfileSection.submitting}
            >
              <TextField
                label={t('publicProfile.publicDisplayName')}
                value={publicDisplayName}
                onChange={(event) => setPublicDisplayName(event.target.value)}
                sx={wideFieldSx}
                helperText={t('publicProfile.helperText')}
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />
            </InlineEditor>
          </Stack>
        </SettingsCard>

        <SettingsCard title={t('sections.security')}>
          <SectionAlerts message={emailSection.message} error={emailSection.error} />
          <SectionAlerts message={passwordSection.message} error={passwordSection.error} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <Button
              variant={activeEditor === 'email' ? 'contained' : 'outlined'}
              onClick={() => setActiveEditor('email')}
              sx={actionButtonSx}
            >
              {t('security.changeEmailTitle')}
            </Button>
            <Button
              variant={activeEditor === 'password' ? 'contained' : 'outlined'}
              onClick={() => setActiveEditor('password')}
              sx={actionButtonSx}
            >
              {t('security.changePasswordTitle')}
            </Button>
          </Stack>

          <InlineEditor
            open={activeEditor === 'email'}
            saveLabel={t('actions.sendConfirmationLink')}
            onSave={() => void handleEmailChangeRequest()}
            onCancel={closeEmailEditor}
            submitting={emailSection.submitting}
            saveDisabled={!newEmail.trim() || !emailPassword.trim()}
            sx={{ mb: 2 }}
          >
            <TextField
              label={t('security.newEmail')}
              type="email"
              sx={wideFieldSx}
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
            <TextField
              label={t('currentPassword')}
              type="password"
              sx={mediumFieldSx}
              value={emailPassword}
              onChange={(event) => setEmailPassword(event.target.value)}
            />
          </InlineEditor>

          <InlineEditor
            open={activeEditor === 'password'}
            saveLabel={t('actions.savePassword')}
            onSave={() => void handlePasswordChange()}
            onCancel={closePasswordEditor}
            submitting={passwordSection.submitting}
            saveDisabled={!currentPassword || !newPassword || !repeatPassword}
          >
            <TextField
              label={t('currentPassword')}
              type="password"
              sx={mediumFieldSx}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <TextField
              label={t('security.newPassword')}
              type="password"
              sx={mediumFieldSx}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <TextField
              label={t('security.repeatNewPassword')}
              type="password"
              sx={mediumFieldSx}
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
            />
          </InlineEditor>
        </SettingsCard>

        <SettingsCard title={t('sections.privacy')} description={t('dataExport.description')}>
          <SectionAlerts message={dataExportSection.message} error={dataExportSection.error} />
          <Button
            variant="outlined"
            onClick={() => void handleDataExport()}
            disabled={dataExportSection.submitting}
            sx={actionButtonSx}
          >
            {t('dataExport.downloadButton')}
          </Button>
        </SettingsCard>

        {import.meta.env.DEV ? (
          <SettingsCard title={t('developer.title')} description={t('developer.hintsDescription')}>
            {hintsResetDone ? <Alert severity="success" sx={{ mb: 2 }}>{t('developer.hintsResetDone')}</Alert> : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="outlined" onClick={handleResetHints}>
                {t('developer.resetHintsAction')}
              </Button>
              <Button variant="outlined" onClick={handleShowOnboardingPreview}>
                {t('developer.showOnboardingAction')}
              </Button>
            </Stack>
          </SettingsCard>
        ) : null}

        <SettingsCard
          title={t('sections.account')}
          description={`${t('deleteDescription')} ${t('restoreDescription')}`}
        >
          <Button color="error" variant="outlined" onClick={() => setDeleteDialogOpen(true)}>
            {t('deleteButton')}
          </Button>
        </SettingsCard>
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('dialogTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">{t('dialogWarning', { phrase: deletePhrase })}</Alert>
            <Typography>{t('deleteDescription')}</Typography>
            <Typography>{t('restoreDescription')}</Typography>
            <TextField
              sx={mediumFieldSx}
              type="password"
              label={t('currentPassword')}
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
            />
            <TextField
              sx={wideFieldSx}
              label={t('deletePhraseLabel')}
              value={deleteConfirmationText}
              onChange={(event) => setDeleteConfirmationText(event.target.value)}
              helperText={t('deletePhraseHelper', { phrase: deletePhrase })}
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
