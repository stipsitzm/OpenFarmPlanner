import { Alert, Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function ForgotPasswordPage(): React.ReactElement {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      setMessage(await requestPasswordReset(email.trim().toLowerCase()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Forgot password</Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {message ? <Alert severity="success">{message}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Button type="submit" variant="contained">Send reset email</Button>
          <Button component={RouterLink} to="/login">Back to login</Button>
        </Stack>
      </Box>
    </Container>
  );
}
