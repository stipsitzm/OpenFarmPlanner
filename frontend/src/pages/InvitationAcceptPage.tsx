import { Alert, Button, Container, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectAPI } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n';
import {
  buildInvitationAcceptPath,
  clearInvitationRedirectStorage,
  getStoredInvitationToken,
  storeInvitationRedirect,
} from './invitationAcceptance';

type AcceptStatus = 'loading' | 'redirecting' | 'success' | 'error';

export default function InvitationAcceptPage(): React.ReactElement {
  const { t } = useTranslation('projectInvitations');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, switchActiveProject } = useAuth();
  const [status, setStatus] = useState<AcceptStatus>('loading');
  const [message, setMessage] = useState<string>('');

  const token = useMemo(() => {
    const tokenFromQuery = searchParams.get('token');
    return tokenFromQuery?.trim() || getStoredInvitationToken();
  }, [searchParams]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('result.invalid_token'));
      return;
    }

    const nextPath = buildInvitationAcceptPath(token);
    storeInvitationRedirect(nextPath, token);

    if (!user) {
      setStatus('redirecting');
      navigate(`/login?next=${encodeURIComponent(nextPath)}`, { replace: true });
      return;
    }

    let cancelled = false;

    const acceptInvitation = async (): Promise<void> => {
      setStatus('loading');
      setMessage(t('acceptPage.accepting'));

      try {
        const response = await projectAPI.acceptInvitation(token);
        const projectId = response.data.project?.id ?? response.data.project_id;
        if (projectId) {
          await switchActiveProject(projectId);
        }
        clearInvitationRedirectStorage();
        if (cancelled) {
          return;
        }
        setStatus('success');
        setMessage(t('acceptPage.addedToProject'));
        window.setTimeout(() => navigate('/app', { replace: true }), 1200);
      } catch (acceptError: unknown) {
        if (cancelled) {
          return;
        }
        const code = (acceptError as { response?: { data?: { code?: string } } })?.response?.data?.code ?? 'invalid_token';
        if (code === 'already_member' || code === 'accepted') {
          clearInvitationRedirectStorage();
          setStatus('success');
          setMessage(t(`result.${code}`));
          window.setTimeout(() => navigate('/app', { replace: true }), 1200);
          return;
        }

        if (code === 'invalid_token' || code === 'expired' || code === 'revoked') {
          clearInvitationRedirectStorage();
        }

        setStatus('error');
        setMessage(t(`result.${code}`, { defaultValue: t('result.invalid_token') }));
      }
    };

    void acceptInvitation();

    return () => {
      cancelled = true;
    };
  }, [navigate, switchActiveProject, t, token, user]);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={2}>
        <Typography variant="h4">{t('acceptPage.title')}</Typography>
        {status === 'loading' || status === 'redirecting' ? (
          <Alert severity="info">
            {status === 'redirecting' ? t('acceptPage.redirectingToLogin') : message || t('acceptPage.accepting')}
          </Alert>
        ) : null}
        {status === 'success' ? <Alert severity="success">{message}</Alert> : null}
        {status === 'error' ? <Alert severity="error">{message}</Alert> : null}
        <Button variant="outlined" onClick={() => navigate('/app', { replace: true })}>
          {t('openApp')}
        </Button>
      </Stack>
    </Container>
  );
}
