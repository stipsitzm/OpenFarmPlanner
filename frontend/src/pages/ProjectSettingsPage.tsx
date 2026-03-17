import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { projectAPI } from '../api/api';
import { useAuth } from '../auth/AuthContext';

export default function ProjectSettingsPage(): React.ReactElement {
  const { user } = useAuth();
  const activeProjectId = Number(window.localStorage.getItem('activeProjectId'));
  const activeMembership = useMemo(
    () => (user?.memberships ?? []).find((membership) => membership.project_id === activeProjectId),
    [activeProjectId, user?.memberships],
  );

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!activeMembership) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5">Projekteinstellungen</Typography>
        <Alert severity="info" sx={{ mt: 2 }}>Kein aktives Projekt ausgewählt.</Alert>
      </Box>
    );
  }

  const handleInvite = async (): Promise<void> => {
    setMessage(null);
    setError(null);
    try {
      const response = await projectAPI.invite(activeMembership.project_id, { email, role });
      const data = response.data as { mail_sent?: boolean; invite_link?: string };
      if (data.mail_sent) {
        setMessage(`Einladung per E-Mail an ${email} wurde versendet.`);
      } else if (data.invite_link) {
        setMessage(`E-Mail konnte nicht versendet werden. Einladung: ${data.invite_link}`);
      } else {
        setMessage(`Einladung für ${email} wurde erstellt.`);
      }
      setEmail('');
      setRole('member');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Einladung konnte nicht versendet werden.');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 760, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 1 }}>Projekteinstellungen</Typography>
      <Typography sx={{ mb: 3 }}><strong>Projekt:</strong> {activeMembership.project_name}</Typography>

      <Typography variant="h6" sx={{ mb: 2 }}>Nutzer einladen</Typography>
      <Stack spacing={2}>
        <TextField
          label="E-Mail"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          select
          label="Rolle"
          value={role}
          onChange={(event) => setRole(event.target.value as 'admin' | 'member')}
        >
          <MenuItem value="member">Member</MenuItem>
          <MenuItem value="admin">Admin</MenuItem>
        </TextField>
        <Button
          variant="contained"
          onClick={() => void handleInvite()}
          disabled={activeMembership.role !== 'admin' || !email.trim()}
        >
          Einladung senden
        </Button>
      </Stack>

      {activeMembership.role !== 'admin' ? (
        <Alert severity="info" sx={{ mt: 2 }}>Nur Admins können Nutzer einladen.</Alert>
      ) : null}
      {message ? <Alert severity="success" sx={{ mt: 2, wordBreak: 'break-all' }}>{message}</Alert> : null}
      {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
    </Box>
  );
}
