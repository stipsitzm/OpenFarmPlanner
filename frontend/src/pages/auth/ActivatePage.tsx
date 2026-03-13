import { Alert, Button, Container, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useTranslation } from '../../i18n';

export default function ActivatePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { activate } = useAuth();
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const uid = searchParams.get('uid');
    const token = searchParams.get('token');

    if (!uid || !token) {
      setStatus('error');
      setMessage(t('activate.incompleteLink'));
      return;
    }

    void (async () => {
      setStatus('loading');
      try {
        await activate(uid, token);
        setStatus('success');
        setMessage(t('activate.success'));
        setTimeout(() => navigate('/app', { replace: true }), 1200);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : t('activate.failed'));
      }
    })();
  }, [activate, navigate, searchParams, t]);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>{t('activate.title')}</Typography>
      <Stack spacing={2}>
        {status === 'loading' ? <Alert severity="info">{t('activate.loading')}</Alert> : null}
        {status === 'success' ? <Alert severity="success">{message}</Alert> : null}
        {status === 'error' ? <Alert severity="error">{message}</Alert> : null}
        <Button component={RouterLink} to="/login">{t('activate.toLogin')}</Button>
      </Stack>
    </Container>
  );
}
