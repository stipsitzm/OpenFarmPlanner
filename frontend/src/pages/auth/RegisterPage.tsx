import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTranslation } from '../../i18n';

export default function RegisterPage(): React.ReactElement {
  const { user, register, resendActivation } = useAuth();
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== passwordConfirm) {
      setError(t('register.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const message = await register(email.trim().toLowerCase(), password, passwordConfirm, displayName.trim());
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('register.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(await resendActivation(email.trim().toLowerCase()));
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>{t('register.title')}</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}
          <TextField label={t('register.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label={t('register.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <TextField label={t('register.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <TextField label={t('register.passwordConfirm')} type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>{submitting ? t('register.submitting') : t('register.submit')}</Button>
          <Button onClick={() => void handleResend()} disabled={!email}>{t('register.resendActivation')}</Button>
          <Button component={RouterLink} to="/login">{t('register.hasAccount')}</Button>
        </Stack>
      </Box>
    </Container>
  );
}
