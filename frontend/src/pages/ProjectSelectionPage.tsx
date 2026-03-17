import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemText, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectAPI } from '../api/api';
import { useAuth } from '../auth/AuthContext';

interface InviteState {
  projectId: number;
  projectName: string;
}

export default function ProjectSelectionPage(): React.ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inviteState, setInviteState] = useState<InviteState | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (): Promise<void> => {
    if (!inviteState) return;
    setError(null);
    try {
      await projectAPI.invite(inviteState.projectId, { email, role });
      setFeedback(`Einladung für ${email} wurde versendet.`);
      setInviteState(null);
      setEmail('');
      setRole('member');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Einladung konnte nicht versendet werden.');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Typography variant="h5" gutterBottom>Projekt auswählen</Typography>
      {feedback ? <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert> : null}
      <List>
        {(user?.memberships ?? []).map((membership) => (
          <ListItem
            key={membership.project_id}
            secondaryAction={(
              <Stack direction="row" spacing={1}>
                {membership.role === 'admin' ? (
                  <Button
                    variant="outlined"
                    onClick={() => setInviteState({ projectId: membership.project_id, projectName: membership.project_name })}
                  >
                    Nutzer einladen
                  </Button>
                ) : null}
                <Button
                  variant="contained"
                  onClick={() => {
                    window.localStorage.setItem('activeProjectId', String(membership.project_id));
                    navigate('/app/anbauplaene');
                  }}
                >
                  Öffnen
                </Button>
              </Stack>
            )}
          >
            <ListItemText primary={membership.project_name} secondary={membership.role} />
          </ListItem>
        ))}
      </List>

      <Dialog open={Boolean(inviteState)} onClose={() => setInviteState(null)} fullWidth maxWidth="sm">
        <DialogTitle>Nutzer zu {inviteState?.projectName} einladen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="E-Mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Rolle"
              value={role}
              onChange={(event) => setRole(event.target.value as 'admin' | 'member')}
              fullWidth
            >
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </TextField>
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteState(null)}>Abbrechen</Button>
          <Button variant="contained" disabled={!email.trim()} onClick={() => void handleInvite()}>
            Einladung senden
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
