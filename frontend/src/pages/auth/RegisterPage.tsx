import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function RegisterPage(): React.ReactElement {
  const { user, register, resendActivation } = useAuth();
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
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const message = await register(email.trim().toLowerCase(), password, passwordConfirm, displayName.trim());
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
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
      <Typography variant="h4" sx={{ mb: 3 }}>Register</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <TextField label="Confirm password" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</Button>
          <Button onClick={() => void handleResend()} disabled={!email}>Resend activation email</Button>
          <Button component={RouterLink} to="/login">Already have an account? Sign in</Button>
        </Stack>
      </Box>
    </Container>
  );
}
