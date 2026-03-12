import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function RegisterPage(): React.ReactElement {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register(username, password, passwordConfirm, email);
      navigate('/app', { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed. Please check your input.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Register</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          <TextField label="Email (optional)" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            helperText="Use at least 8 characters."
          />
          <TextField label="Confirm password" type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</Button>
          <Button component={RouterLink} to="/login">Already have an account? Sign in</Button>
        </Stack>
      </Box>
    </Container>
  );
}
