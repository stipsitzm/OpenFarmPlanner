import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function ResetPasswordPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { confirmPasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const uid = searchParams.get('uid') ?? '';
    const token = searchParams.get('token') ?? '';

    try {
      setMessage(await confirmPasswordReset(uid, token, password, passwordConfirm));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Reset password</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {message ? <Alert severity="success">{message}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <TextField label="Confirm new password" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} required />
          <Button type="submit" variant="contained">Reset password</Button>
          <Button component={RouterLink} to="/login">Back to login</Button>
        </Stack>
      </Box>
    </Container>
  );
}
