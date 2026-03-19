import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { projectAPI, type ProjectInvitationPayload, type ProjectMemberPayload } from '../api/api';
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
  const [members, setMembers] = useState<ProjectMemberPayload[]>([]);
  const [pendingRemovalMember, setPendingRemovalMember] = useState<ProjectMemberPayload | null>(null);
  const [memberLoadError, setMemberLoadError] = useState<string | null>(null);
  const [invitationLoadError, setInvitationLoadError] = useState<string | null>(null);

  const isProjectAdmin = activeMembership?.role === 'admin';
  const canManageMembers = isProjectAdmin;

  const extractErrorPayload = (error: unknown): { code: string | null; detail: string | null } => {
    const payload = (error as { response?: { data?: { code?: string; detail?: string } } })?.response?.data;
    return {
      code: payload?.code ?? null,
      detail: payload?.detail ?? null,
    };
  };

  const loadInvitations = useCallback(async (): Promise<void> => {
    if (!activeMembership || !canManageMembers) {
      setInvitations([]);
      setInvitationLoadError(null);
      return;
    }
    try {
      const response = await projectAPI.listInvitations(activeMembership.project_id);
      setInvitations(response.data);
      setInvitationLoadError(null);
    } catch {
      setInvitations([]);
      setInvitationLoadError(t('projectMembers.invitations.loadError'));
    }
  }, [activeMembership, canManageMembers, t]);

  const loadMembers = useCallback(async (): Promise<void> => {
    if (!activeMembership) {
      return;
    }
    try {
      const response = await projectAPI.listMembers(activeMembership.project_id);
      setMembers(response.data);
      setMemberLoadError(null);
    } catch {
      setMembers([]);
      setMemberLoadError(t('memberListLoadFailed'));
    }
  }, [activeMembership, t]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  if (!activeMembership) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5">{t('title')}</Typography>
        <Alert severity="info" sx={{ mt: 2 }}>{t('noActiveProject')}</Alert>
      </Box>
    );
  }

  const handleInvite = async (): Promise<void> => {
    if (!canManageMembers) {
      setFeedback({ severity: 'error', text: t('projectMembers.invite.noPermission') });
      return;
    }

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

  const handleMemberRoleChange = async (membershipId: number, nextRole: 'admin' | 'member', isCurrentUser: boolean): Promise<void> => {
    if (isCurrentUser) {
      setFeedback({ severity: 'error', text: t('roleChangeBlocked') });
      return;
    }
    try {
      await projectAPI.updateMember(activeMembership.project_id, membershipId, nextRole);
      setFeedback({ severity: 'success', text: t('memberRoleUpdated') });
      await loadMembers();
    } catch (memberError: unknown) {
      const payload = extractErrorPayload(memberError);
      const message = payload.code
        ? t(`error.${payload.code}`, { defaultValue: payload.detail ?? t('memberRoleUpdateFailed') })
        : (payload.detail ?? t('memberRoleUpdateFailed'));
      setFeedback({ severity: 'error', text: message });
    }
  };

  const handleRemoveMember = async (membershipId: number, isCurrentUser: boolean): Promise<void> => {
    if (isCurrentUser) {
      setFeedback({ severity: 'error', text: t('removeBlocked') });
      return;
    }
    try {
      await projectAPI.removeMember(activeMembership.project_id, membershipId);
      setFeedback({ severity: 'success', text: t('memberRemoved') });
      setPendingRemovalMember(null);
      await loadMembers();
    } catch (memberError: unknown) {
      const payload = extractErrorPayload(memberError);
      const message = payload.code
        ? t(`error.${payload.code}`, { defaultValue: payload.detail ?? t('memberRemoveFailed') })
        : (payload.detail ?? t('memberRemoveFailed'));
      setFeedback({ severity: 'error', text: message });
    }
  };

  const invitationStatus = (() => {
    if (!canManageMembers) {
      return <Alert severity="info">{t('projectMembers.invitations.noAccess')}</Alert>;
    }
    if (invitationLoadError) {
      return <Alert severity="error">{invitationLoadError}</Alert>;
    }
    if (invitations.length === 0) {
      return <Alert severity="info">{t('projectMembers.invitations.empty')}</Alert>;
    }
    return null;
  })();

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
          disabled={!canManageMembers}
        />
        <TextField
          select
          label={t('roleLabel')}
          value={role}
          onChange={(event) => setRole(event.target.value as 'admin' | 'member')}
          disabled={!canManageMembers}
        >
          <MenuItem value="member">{t('roleMember')}</MenuItem>
          <MenuItem value="admin">{t('roleAdmin')}</MenuItem>
        </TextField>
        <Button
          variant="contained"
          onClick={() => void handleInvite()}
          disabled={!canManageMembers || !email.trim()}
        >
          {t('sendInvite')}
        </Button>
      </Stack>

      {!canManageMembers ? (
        <Alert severity="info" sx={{ mt: 2 }}>{t('projectMembers.invite.noPermission')}</Alert>
      ) : null}

      {feedback ? <Alert severity={feedback.severity} sx={{ mt: 2, wordBreak: 'break-all' }}>{feedback.text}</Alert> : null}

      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>{t('membersSectionTitle')}</Typography>
      <Stack spacing={1.5}>
        {memberLoadError ? <Alert severity="error">{memberLoadError}</Alert> : null}
        {!memberLoadError ? members.map((member) => {
          const isCurrentUser = member.user === user?.id;
          const displayName = member.user_display_name || t('memberDisplayFallback');

          return (
            <Box key={member.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 600 }}>{displayName}</Typography>
                    {isCurrentUser ? <Chip label={t('memberYou')} size="small" /> : null}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{member.user_email}</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <TextField
                    select
                    size="small"
                    label={t('memberRoleLabel')}
                    value={member.role}
                    onChange={(event) => void handleMemberRoleChange(member.id, event.target.value as 'admin' | 'member', isCurrentUser)}
                    disabled={!canManageMembers || isCurrentUser}
                    sx={{ minWidth: 160 }}
                  >
                    <MenuItem value="member">{t('roleMember')}</MenuItem>
                    <MenuItem value="admin">{t('roleAdmin')}</MenuItem>
                  </TextField>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setPendingRemovalMember(member)}
                    disabled={!canManageMembers || isCurrentUser}
                  >
                    {t('removeMember')}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          );
        }) : null}
        {!memberLoadError && members.length === 0 ? <Alert severity="info">{t('membersEmpty')}</Alert> : null}
      </Stack>

      <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>{t('listTitle')}</Typography>
      <Stack spacing={1.5}>
        {canManageMembers && !invitationLoadError ? invitations.map((invitation) => (
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
                {invitation.resolved_status === 'pending' ? (
                  <Button size="small" color="error" onClick={() => void handleRevoke(invitation.id)}>
                    {t('revoke')}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Box>
        )) : null}
        {invitationStatus}
      </Stack>

      <Dialog open={pendingRemovalMember !== null} onClose={() => setPendingRemovalMember(null)} fullWidth maxWidth="xs">
        <DialogTitle>{t('removeDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('removeDialogText', {
              email: pendingRemovalMember?.user_email ?? '',
              name: pendingRemovalMember?.user_display_name || t('memberDisplayFallback'),
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemovalMember(null)}>{t('removeDialogCancel')}</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => pendingRemovalMember ? void handleRemoveMember(pendingRemovalMember.id, pendingRemovalMember.user === user?.id) : undefined}
          >
            {t('removeDialogConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
