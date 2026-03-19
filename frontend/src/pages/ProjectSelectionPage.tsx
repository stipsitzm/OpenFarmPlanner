import { Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProjectSelectionPage(): React.ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <Typography variant="h5" gutterBottom>Projekt auswählen</Typography>
      <List>
        {(user?.memberships ?? []).map((membership) => (
          <ListItem
            key={membership.project_id}
            secondaryAction={
              <Button
                variant="contained"
                onClick={() => {
                  window.localStorage.setItem('activeProjectId', String(membership.project_id));
                  navigate('/app/anbauplaene');
                }}
              >
                Öffnen
              </Button>
            }
          >
            <ListItemText primary={membership.project_name} secondary={membership.role} />
          </ListItem>
        ))}
      </List>
    </div>
  );
}
