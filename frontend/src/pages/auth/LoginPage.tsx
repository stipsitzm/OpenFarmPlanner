import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AuthApiError } from '../../auth/authApi';
import { useTranslation } from '../../i18n';

export default function LoginPage(): React.ReactElement {
  const { user, login, restoreAccount } = useAuth();
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeletionAt, setPendingDeletionAt] = useState<string | null>(null);

  if (user) return <Navigate to="/app" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const me = await login(email.trim().toLowerCase(), password);
      const hasProjects = (me.memberships?.length ?? 0) > 0;
      const target = me.needs_project_selection || !hasProjects ? '/app/project-selection' : '/app';
      const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
      const destination = from?.pathname ? `${from.pathname}${from.search ?? ''}` : target;
      navigate(destination, { replace: true });
    } catch (err) {
      if (err instanceof AuthApiError && err.code === 'account_pending_deletion') {
        setPendingDeletionAt(err.scheduledDeletionAt ?? null);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : t('login.failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const me = await restoreAccount(email.trim().toLowerCase(), password);
      const hasProjects = (me.memberships?.length ?? 0) > 0;
      navigate(hasProjects ? '/app' : '/app/project-selection', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.restoreFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>{t('login.title')}</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {pendingDeletionAt ? (
            <Alert severity="warning">
              {t('login.pendingDeletion', { date: new Date(pendingDeletionAt).toLocaleString('de-DE') })}
            </Alert>
          ) : null}
          <TextField label={t('login.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label={t('login.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>{submitting ? t('login.submitting') : t('login.submit')}</Button>
          {pendingDeletionAt ? (
            <Button variant="outlined" disabled={submitting} onClick={() => void handleRestore()}>
              {t('login.restoreAccount')}
            </Button>
          ) : null}
          <Button component={RouterLink} to="/register">{t('login.noAccount')}</Button>
          <Button component={RouterLink} to="/forgot-password">{t('login.forgotPassword')}</Button>
        </Stack>
      </Box>
    </Container>
  );
}
