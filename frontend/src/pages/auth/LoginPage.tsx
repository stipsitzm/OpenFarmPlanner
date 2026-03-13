import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTranslation } from '../../i18n';

export default function LoginPage(): React.ReactElement {
  const { user, login } = useAuth();
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email.trim().toLowerCase(), password);
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
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
          <TextField label={t('login.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label={t('login.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>{submitting ? t('login.submitting') : t('login.submit')}</Button>
          <Button component={RouterLink} to="/register">{t('login.noAccount')}</Button>
          <Button component={RouterLink} to="/forgot-password">{t('login.forgotPassword')}</Button>
        </Stack>
      </Box>
    </Container>
  );
}
