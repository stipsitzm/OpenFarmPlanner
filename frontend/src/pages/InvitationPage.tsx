import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectAPI, type InvitationPublicStatus } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n';

type InvitationViewStatus = 'loading' | 'ready' | 'accepting' | 'success' | 'error';

export default function InvitationPage(): React.ReactElement {
  const { t } = useTranslation(['projectInvitations', 'auth']);
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const { user, logout, switchActiveProject } = useAuth();
  const [status, setStatus] = useState<InvitationViewStatus>('loading');
  const [publicState, setPublicState] = useState<InvitationPublicStatus | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const autoAcceptStartedRef = useRef(false);

  const invitationPath = useMemo(() => (token ? `/invite/${token}` : '/invite/invalid'), [token]);

  const extractApiCode = (error: unknown): string => {
    return (error as { response?: { data?: { code?: string } } })?.response?.data?.code ?? 'invalid_token';
  };

  const openLogin = (): void => {
    navigate('/login', { state: { from: { pathname: invitationPath } } });
  };

  const openRegister = (): void => {
    navigate('/register', { state: { from: { pathname: invitationPath } } });
  };

  const handleAccept = async (): Promise<void> => {
    if (!token) {
      return;
    }

    setStatus('accepting');
    setErrorCode(null);

    try {
      const response = await projectAPI.acceptInvitationByToken(token);
      if (response.data.project_id) {
        await switchActiveProject(response.data.project_id);
      }
      setStatus('success');
      setTimeout(() => navigate('/app', { replace: true }), 1200);
    } catch (acceptError: unknown) {
      setStatus('error');
      setErrorCode(extractApiCode(acceptError));
    }
  };

  useEffect(() => {
    autoAcceptStartedRef.current = false;
  }, [token]);

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
      } catch (fetchError: unknown) {
        setStatus('error');
        setErrorCode(extractApiCode(fetchError));
      }
    };

    void fetchInvitation();
  }, [token]);

  useEffect(() => {
    if (!user || !publicState || status !== 'ready' || publicState.code !== 'pending' || autoAcceptStartedRef.current) {
      return;
    }

    autoAcceptStartedRef.current = true;
    void handleAccept();
  }, [publicState, status, user]);

  const handleLoginWithDifferentAccount = async (): Promise<void> => {
    await logout();
    openLogin();
  };

  const renderInfo = (): React.ReactElement => {
    if (status === 'loading' || status === 'accepting') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography>{status === 'loading' ? t('projectInvitations:loading') : t('projectInvitations:accepting')}</Typography>
        </Box>
      );
    }

    if (status === 'success') {
      return <Alert severity="success">{t('projectInvitations:result.accepted')}</Alert>;
    }

    if (status === 'error') {
      return <Alert severity="error">{t(`projectInvitations:result.${errorCode ?? 'invalid_token'}`)}</Alert>;
    }

    if (!publicState) {
      return <Alert severity="error">{t('projectInvitations:result.invalid_token')}</Alert>;
    }

    return (
      <Stack spacing={2}>
        <Alert severity={publicState.code === 'pending' ? 'info' : 'error'}>{t(`projectInvitations:result.${publicState.code}`)}</Alert>
        <Typography variant="body2">{t('projectInvitations:projectName', { name: publicState.project_name ?? '-' })}</Typography>
        <Typography variant="body2">{t('projectInvitations:emailMasked', { email: publicState.email_masked ?? '-' })}</Typography>

        {!user ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" onClick={openLogin}>
              {t('projectInvitations:toLogin')}
            </Button>
            <Button variant="outlined" onClick={openRegister}>
              {t('projectInvitations:toRegister')}
            </Button>
          </Stack>
        ) : null}

        {user && publicState.code === 'already_member' ? (
          <Button variant="contained" onClick={() => navigate('/app', { replace: true })}>
            {t('projectInvitations:openApp')}
          </Button>
        ) : null}

        {user && publicState.code === 'email_mismatch' ? (
          <Button variant="outlined" onClick={() => void handleLoginWithDifferentAccount()}>
            {t('projectInvitations:loginWithDifferentAccount')}
          </Button>
        ) : null}
      </Stack>
    );
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={2}>
        <Typography variant="h4">{t('projectInvitations:inviteTitle')}</Typography>
        {renderInfo()}
      </Stack>
    </Container>
  );
}
