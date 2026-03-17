import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { projectAPI } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n';

export default function InvitationPage(): React.ReactElement {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, switchActiveProject } = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const token = new URLSearchParams(location.search).get('token')?.trim() ?? '';

  useEffect(() => {
    if (!user || !token || status !== 'idle') {
      return;
    }

    const acceptInvitation = async (): Promise<void> => {
      setStatus('loading');
      try {
        const response = await projectAPI.acceptInvitation(token);
        const projectId = response.data.project_id;
        if (projectId) {
          try {
            await switchActiveProject(projectId);
          } catch {
            window.localStorage.setItem('activeProjectId', String(projectId));
          }
        }
        setMessage(t('invitation.accepted'));
        setStatus('success');
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : t('invitation.failed'));
      }
    };

    void acceptInvitation();
  }, [status, switchActiveProject, t, token, user]);

  if (!token) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="error">{t('invitation.missingToken')}</Alert>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Stack spacing={2}>
          <Typography variant="h4">{t('invitation.title')}</Typography>
          <Alert severity="info">{t('invitation.loginRequired')}</Alert>
          <Button
            variant="contained"
            onClick={() => navigate('/login', {
              replace: true,
              state: { from: { pathname: location.pathname, search: location.search } },
            })}
          >
            {t('invitation.toLogin')}
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={2}>
        <Typography variant="h4">{t('invitation.title')}</Typography>
        {status === 'loading' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography>{t('invitation.processing')}</Typography>
          </Box>
        ) : null}
        {status === 'success' ? <Alert severity="success">{message}</Alert> : null}
        {status === 'error' ? <Alert severity="error">{message}</Alert> : null}
        {status === 'success' ? (
          <Button variant="contained" onClick={() => navigate('/app', { replace: true })}>
            {t('invitation.openApp')}
          </Button>
        ) : null}
      </Stack>
    </Container>
  );
}
