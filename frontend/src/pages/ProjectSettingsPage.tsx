import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { projectAPI, type ProjectInvitationPayload } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from '../i18n';

interface InviteFeedback {
  severity: 'success' | 'error';
  text: string;
}

export default function ProjectSettingsPage(): React.ReactElement {
  const { t } = useTranslation('projectInvitations');
  const { user } = useAuth();
  const activeProjectId = Number(window.localStorage.getItem('activeProjectId'));
  const activeMembership = useMemo(
    () => (user?.memberships ?? []).find((membership) => membership.project_id === activeProjectId),
    [activeProjectId, user?.memberships],
  );

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [feedback, setFeedback] = useState<InviteFeedback | null>(null);
  const [invitations, setInvitations] = useState<ProjectInvitationPayload[]>([]);

  const canManageInvites = activeMembership?.role === 'admin';

  const extractErrorPayload = (error: unknown): { code: string | null; detail: string | null } => {
    const payload = (error as { response?: { data?: { code?: string; detail?: string } } })?.response?.data;
    return {
      code: payload?.code ?? null,
      detail: payload?.detail ?? null,
    };
  };

  const loadInvitations = useCallback(async (): Promise<void> => {
    if (!activeMembership) {
      return;
    }
    try {
      const response = await projectAPI.listInvitations(activeMembership.project_id);
      setInvitations(response.data);
    } catch {
      setFeedback((current) => current ?? { severity: 'error', text: t('listLoadFailed') });
    }
  }, [activeMembership]);

  useEffect(() => {
    void loadInvitations();
  }, [activeMembership?.project_id]);

  if (!activeMembership) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5">{t('title')}</Typography>
        <Alert severity="info" sx={{ mt: 2 }}>{t('noActiveProject')}</Alert>
      </Box>
    );
  }

  const handleInvite = async (): Promise<void> => {
    setFeedback(null);
    try {
      const response = await projectAPI.invite(activeMembership.project_id, { email, role });
      const data = response.data as { code?: string; mail_sent?: boolean; invite_link?: string };
      if (data.code === 'invitation_resent') {
        setFeedback({ severity: 'success', text: t('inviteResent') });
      } else {
        setFeedback({ severity: 'success', text: t('inviteSent') });
      }
      if (!data.mail_sent && data.invite_link) {
        setFeedback({ severity: 'success', text: `${t('inviteSentNoMail')} ${data.invite_link}` });
      }
      setEmail('');
      setRole('member');
      await loadInvitations();
    } catch (inviteError: unknown) {
      const payload = extractErrorPayload(inviteError);
      const message = payload.code
        ? t(`error.${payload.code}`, { defaultValue: payload.detail ?? t('inviteFailed') })
        : (payload.detail ?? t('inviteFailed'));
      setFeedback({ severity: 'error', text: message });
    }
  };

  const handleRevoke = async (invitationId: number): Promise<void> => {
    setFeedback(null);
    try {
      await projectAPI.revokeInvitation(activeMembership.project_id, invitationId);
      await loadInvitations();
      setFeedback({ severity: 'success', text: t('revokeSuccess') });
    } catch {
      setFeedback({ severity: 'error', text: t('revokeFailed') });
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 760, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 1 }}>{t('title')}</Typography>
      <Typography sx={{ mb: 3 }}>{t('projectLabel', { name: activeMembership.project_name })}</Typography>

      <Typography variant="h6" sx={{ mb: 2 }}>{t('inviteSectionTitle')}</Typography>
      <Stack spacing={2}>
        <TextField
          label={t('emailLabel')}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          select
          label={t('roleLabel')}
          value={role}
          onChange={(event) => setRole(event.target.value as 'admin' | 'member')}
        >
          <MenuItem value="member">{t('roleMember')}</MenuItem>
          <MenuItem value="admin">{t('roleAdmin')}</MenuItem>
        </TextField>
        <Button
          variant="contained"
          onClick={() => void handleInvite()}
          disabled={!canManageInvites || !email.trim()}
        >
          {t('sendInvite')}
        </Button>
      </Stack>

      {!canManageInvites ? (
        <Alert severity="info" sx={{ mt: 2 }}>{t('adminOnly')}</Alert>
      ) : null}

      {feedback ? <Alert severity={feedback.severity} sx={{ mt: 2, wordBreak: 'break-all' }}>{feedback.text}</Alert> : null}

      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>{t('listTitle')}</Typography>
      <Stack spacing={1.5}>
        {invitations.map((invitation) => (
          <Box key={invitation.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{invitation.email}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('expiresAt', { date: new Date(invitation.expires_at).toLocaleString() })}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={t(`status.${invitation.resolved_status}`)} size="small" />
                {canManageInvites && invitation.resolved_status === 'pending' ? (
                  <Button size="small" color="error" onClick={() => void handleRevoke(invitation.id)}>
                    {t('revoke')}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Box>
        ))}
        {invitations.length === 0 ? <Alert severity="info">{t('listEmpty')}</Alert> : null}
      </Stack>
    </Box>
  );
}
