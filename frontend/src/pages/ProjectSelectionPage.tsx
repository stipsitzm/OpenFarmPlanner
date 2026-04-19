import { Alert, Box, Button, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../i18n';
import { openProjectCreationFlow } from '../projects/projectCreationFlow';

export default function ProjectSelectionPage(): React.ReactElement {
  const { user, switchActiveProject } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation(['navigation', 'common']);
  const memberships = user?.memberships ?? [];

  const openProject = async (projectId: number): Promise<void> => {
    await switchActiveProject(projectId);
    navigate('/app/locations', { replace: true });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Stack spacing={2}>
        <Typography variant="h5">{t('project.switch')}</Typography>

        {memberships.length === 0 ? (
          <Alert severity="info">
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('common:projectRequired.noProjectsTitle')}
              </Typography>
              <Typography variant="body2">
                {t('common:projectRequired.noProjectsSelectionDescription')}
              </Typography>
              <Box>
                <Button variant="contained" onClick={() => openProjectCreationFlow()}>
                  {t('common:projectRequired.createFirstProjectAction')}
                </Button>
              </Box>
            </Stack>
          </Alert>
        ) : (
          <>
            <Box>
              <Button variant="outlined" onClick={() => openProjectCreationFlow()}>
                {t('project.create')}
              </Button>
            </Box>
            <List>
              {memberships.map((membership) => (
                <ListItem
                  key={membership.project_id}
                  secondaryAction={(
                    <Button
                      variant="contained"
                      onClick={() => {
                        void openProject(membership.project_id);
                      }}
                    >
                      {t('projectSwitcher.openProjectAction')}
                    </Button>
                  )}
                >
                  <ListItemText
                    primary={membership.project_name}
                    secondary={t(`projectRoles.${membership.role}`)}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </Stack>
    </Box>
  );
}
