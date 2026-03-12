import { Alert, Button, Container, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function ActivatePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { activate } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const uid = searchParams.get('uid');
    const token = searchParams.get('token');

    if (!uid || !token) {
      setStatus('error');
      setMessage('Activation link is incomplete.');
      return;
    }

    void (async () => {
      setStatus('loading');
      try {
        await activate(uid, token);
        setStatus('success');
        setMessage('Account activated successfully. Redirecting to app...');
        setTimeout(() => navigate('/app', { replace: true }), 1200);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Activation failed.');
      }
    })();
  }, [activate, navigate, searchParams]);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>Activate account</Typography>
      <Stack spacing={2}>
        {status === 'loading' ? <Alert severity="info">Activating account…</Alert> : null}
        {status === 'success' ? <Alert severity="success">{message}</Alert> : null}
        {status === 'error' ? <Alert severity="error">{message}</Alert> : null}
        <Button component={RouterLink} to="/login">Go to login</Button>
      </Stack>
    </Container>
  );
}
