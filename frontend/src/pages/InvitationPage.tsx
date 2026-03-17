import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectAPI, type InvitationPublicStatus } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n';

export default function InvitationPage(): React.ReactElement {
  const { t } = useTranslation('projectInvitations');
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { user, switchActiveProject } = useAuth();
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'error'>('loading');
  const [publicState, setPublicState] = useState<InvitationPublicStatus | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorCode('invalid_token');
      return;
    }

    const fetchInvitation = async (): Promise<void> => {
      try {
        const response = await projectAPI.getInvitationStatus(token);
        setPublicState(response.data);
        setStatus('ready');
      } catch {
        setStatus('error');
        setErrorCode('invalid_token');
      }
    };

    void fetchInvitation();
  }, [token]);

  const handleAccept = async (): Promise<void> => {
    if (!token) {
      return;
    }
    setStatus('accepting');
    try {
      const response = await projectAPI.acceptInvitationByToken(token);
      if (response.data.project_id) {
        await switchActiveProject(response.data.project_id);
      }
      navigate('/app', { replace: true });
    } catch (acceptError: unknown) {
      const code = (acceptError as { response?: { data?: { code?: string } } })?.response?.data?.code ?? 'invalid_token';
      setStatus('error');
      setErrorCode(code);
    }
  };

  const renderInfo = (): React.ReactElement => {
    if (status === 'loading' || status === 'accepting') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography>{status === 'loading' ? t('loading') : t('accepting')}</Typography>
        </Box>
      );
    }

    if (status === 'error') {
      return <Alert severity="error">{t(`result.${errorCode ?? 'invalid_token'}`)}</Alert>;
    }

    if (!publicState) {
      return <Alert severity="error">{t('result.invalid_token')}</Alert>;
    }

    return (
      <Stack spacing={2}>
        <Alert severity="info">{t(`result.${publicState.code}`)}</Alert>
        <Typography variant="body2">{t('projectName', { name: publicState.project_name ?? '-' })}</Typography>
        <Typography variant="body2">{t('emailMasked', { email: publicState.email_masked ?? '-' })}</Typography>

        {!user ? (
          <Button variant="contained" onClick={() => navigate('/login', { state: { from: { pathname: `/invite/${token}` } } })}>
            {t('toLogin')}
          </Button>
        ) : null}

        {user && publicState.code === 'pending' ? (
          <Button variant="contained" onClick={() => void handleAccept()}>
            {t('acceptAction')}
          </Button>
        ) : null}

        {user && publicState.code === 'already_member' ? (
          <Button variant="contained" onClick={() => navigate('/app', { replace: true })}>
            {t('openApp')}
          </Button>
        ) : null}
      </Stack>
    );
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={2}>
        <Typography variant="h4">{t('inviteTitle')}</Typography>
        {renderInfo()}
      </Stack>
    </Container>
  );
}
