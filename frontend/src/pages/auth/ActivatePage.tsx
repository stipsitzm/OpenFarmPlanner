import { Alert, Button, Container, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { projectAPI } from '../../api/api';
import { useAuth } from '../../auth/useAuth';
import { useTranslation } from '../../i18n';
import { buildInvitationAcceptPath, getStoredInvitationNext, getStoredInvitationToken } from '../invitationAcceptance';

type ActivateStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ActivatePage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { uid: uidFromPath, token: tokenFromPath } = useParams<{ uid?: string; token?: string }>();
  const { activate, switchActiveProject } = useAuth();
  const { t } = useTranslation(['auth', 'projectInvitations']);
  const navigate = useNavigate();
  const [status, setStatus] = useState<ActivateStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const processedActivationRef = useRef<string | null>(null);

  useEffect(() => {
    const uidFromQuery = searchParams.get('uid');
    const tokenFromQuery = searchParams.get('token') ?? searchParams.get('amp;token');

    const uid = uidFromQuery?.trim() || uidFromPath?.trim() || null;
    const token = tokenFromQuery?.trim() || tokenFromPath?.trim() || null;

    if (!uid || !token) {
      queueMicrotask(() => {
        setStatus('error');
        setMessage(t('auth:activate.incompleteLink'));
      });
      return;
    }
    const activationKey = `${uid}:${token}`;
    if (processedActivationRef.current === activationKey) {
      return;
    }
    processedActivationRef.current = activationKey;

    void (async () => {
      queueMicrotask(() => {
        setStatus('loading');
      });
      try {
        await activate(uid, token);

        const storedNext = getStoredInvitationNext();
        const storedToken = getStoredInvitationToken();
        const invitationReturnPath = storedNext ?? (storedToken ? buildInvitationAcceptPath(storedToken) : null);

        if (invitationReturnPath) {
          setStatus('success');
          setMessage(t('projectInvitations:acceptPage.redirectingBack'));
          setTimeout(() => navigate(invitationReturnPath, { replace: true }), 800);
          return;
        }

        try {
          const invitationResponse = await projectAPI.acceptPendingInvitation();
          if (invitationResponse.data.project_id) {
            await switchActiveProject(invitationResponse.data.project_id);
          }
          setMessage(t(`projectInvitations:result.${invitationResponse.data.code}`, { defaultValue: t('auth:activate.success') }));
        } catch (invitationError: unknown) {
          const invitationCode = (invitationError as { response?: { data?: { code?: string } } })?.response?.data?.code;
          if (invitationCode && invitationCode !== 'no_pending_invitation') {
            setStatus('error');
            setMessage(t(`projectInvitations:result.${invitationCode}`, { defaultValue: t('auth:activate.success') }));
            return;
          }
          setMessage(t('auth:activate.success'));
        }

        setStatus('success');
        setTimeout(() => navigate('/app', { replace: true }), 1200);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : t('auth:activate.failed'));
      }
    })();
  }, [activate, navigate, searchParams, switchActiveProject, t, tokenFromPath, uidFromPath]);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>{t('auth:activate.title')}</Typography>
      <Stack spacing={2}>
        {status === 'loading' ? <Alert severity="info">{t('auth:activate.loading')}</Alert> : null}
        {status === 'success' ? <Alert severity="success">{message}</Alert> : null}
        {status === 'error' ? <Alert severity="error">{message}</Alert> : null}
        <Button component={RouterLink} to="/login">{t('auth:activate.toLogin')}</Button>
      </Stack>
    </Container>
  );
}
