import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import { projectAPI, type InvitationPublicStatus } from '../../api/api';
import { useAuth } from '../../auth/AuthContext';
import { useTranslation } from '../../i18n';

export default function RegisterPage(): React.ReactElement {
  const { user, register, resendActivation } = useAuth();
  const { t } = useTranslation(['auth', 'projectInvitations']);
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingInvitation, setPendingInvitation] = useState<InvitationPublicStatus | null>(null);

  useEffect(() => {
    const loadPendingInvitation = async (): Promise<void> => {
      try {
        const response = await projectAPI.getPendingInvitation();
        if (response.data.code !== 'no_pending_invitation') {
          setPendingInvitation(response.data);
        }
      } catch {
        setPendingInvitation(null);
      }
    };

    void loadPendingInvitation();
  }, []);

  if (user) return <Navigate to="/app" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== passwordConfirm) {
      setError(t('auth:register.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const message = await register(email.trim().toLowerCase(), password, passwordConfirm, displayName.trim());
      setSuccess(pendingInvitation ? t('projectInvitations:registerSuccessWithInvitation', { detail: message }) : message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth:register.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    setError(null);
    setSuccess(await resendActivation(email.trim().toLowerCase()));
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>{t('auth:register.title')}</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {pendingInvitation ? (
            <Alert severity="info">
              {t('projectInvitations:registerHint', {
                project: pendingInvitation.project_name ?? '–',
                email: pendingInvitation.email_masked ?? '–',
              })}
            </Alert>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}
          <TextField label={t('auth:register.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label={t('auth:register.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <TextField label={t('auth:register.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <TextField label={t('auth:register.passwordConfirm')} type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>{submitting ? t('auth:register.submitting') : t('auth:register.submit')}</Button>
          <Button onClick={() => void handleResend()} disabled={!email}>{t('auth:register.resendActivation')}</Button>
          <Button component={RouterLink} to="/login" state={location.state}>{t('auth:register.hasAccount')}</Button>
        </Stack>
      </Box>
    </Container>
  );
}
