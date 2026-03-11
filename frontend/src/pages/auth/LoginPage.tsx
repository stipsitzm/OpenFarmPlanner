import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function LoginPage(): React.ReactElement {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/app" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(username, password);
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/app';
      navigate(destination, { replace: true });
    } catch {
      setError('Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Login</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</Button>
        </Stack>
      </Box>
    </Container>
  );
}
