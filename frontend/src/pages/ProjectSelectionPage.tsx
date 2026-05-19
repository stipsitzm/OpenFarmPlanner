import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectAPI, type ProjectPayload } from '../api/api';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../i18n';
import { openProjectCreationFlow } from '../projects/projectCreationFlow';

export default function ProjectSelectionPage(): React.ReactElement {
  const { user, switchActiveProject, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation(['navigation', 'common']);
  const memberships = user?.memberships ?? [];
  const [deletedProjects, setDeletedProjects] = useState<ProjectPayload[]>([]);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());

  const loadDeletedProjects = useCallback(async (): Promise<void> => {
    try {
      const response = await projectAPI.listDeleted();
      const payload = response.data;
      setDeletedProjects(Array.isArray(payload) ? payload : payload.results);
      setTrashError(null);
    } catch {
      setDeletedProjects([]);
      setTrashError(t('projectTrash.loadError'));
    }
  }, [t]);

  useEffect(() => {
    window.setTimeout(() => {
      void loadDeletedProjects();
    }, 0);
  }, [loadDeletedProjects]);

  const deletedProjectsByName = useMemo(
    () => [...deletedProjects].sort((left, right) => left.name.localeCompare(right.name)),
    [deletedProjects],
  );

  const openProject = async (projectId: number): Promise<void> => {
    await switchActiveProject(projectId);
    navigate('/app/fields-beds', { replace: true });
  };

  const showSnackbar = (message: string, severity: 'success' | 'error'): void => {
    window.dispatchEvent(new CustomEvent('ofp:show-snackbar', {
      detail: { message, severity },
    }));
  };

  const getDeletedAgeLabel = (deletedAt: string | null): string => {
    if (!deletedAt) {
      return t('projectTrash.deletedUnknown');
    }
    const deletedTime = new Date(deletedAt).getTime();
    if (!Number.isFinite(deletedTime)) {
      return t('projectTrash.deletedUnknown');
    }
    const days = Math.max(0, Math.floor((renderedAt - deletedTime) / 86_400_000));
    return t('projectTrash.deletedDays', { count: days });
  };

  const restoreProject = async (projectId: number): Promise<void> => {
    try {
      await projectAPI.restore(projectId);
      await refreshUser();
      await loadDeletedProjects();
      showSnackbar(t('projectTrash.restoreSuccess'), 'success');
    } catch {
      showSnackbar(t('projectTrash.restoreError'), 'error');
    }
  };

  const permanentlyDeleteProject = async (project: ProjectPayload): Promise<void> => {
    if (!window.confirm(t('projectTrash.permanentConfirm', { name: project.name }))) {
      return;
    }
    try {
      await projectAPI.permanentDelete(project.id);
      setDeletedProjects((current) => current.filter((item) => item.id !== project.id));
      showSnackbar(t('projectTrash.permanentSuccess'), 'success');
    } catch {
      showSnackbar(t('projectTrash.permanentError'), 'error');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Stack spacing={2}>
        <Typography variant="h5">{t('project.switch')}</Typography>

        {memberships.length === 0 ? (
          <Alert severity="info">
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
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

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {t('projectTrash.title')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              {trashError ? <Alert severity="error">{trashError}</Alert> : null}
              {!trashError && deletedProjectsByName.length === 0 ? (
                <Alert severity="info">{t('projectTrash.empty')}</Alert>
              ) : null}
              {!trashError && deletedProjectsByName.length > 0 ? (
                <List>
                  {deletedProjectsByName.map((project) => (
                    <ListItem
                      key={project.id}
                      secondaryAction={(
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              void restoreProject(project.id);
                            }}
                          >
                            {t('projectTrash.restore')}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              void permanentlyDeleteProject(project);
                            }}
                          >
                            {t('projectTrash.permanentDelete')}
                          </Button>
                        </Stack>
                      )}
                    >
                      <ListItemText
                        primary={project.name}
                        secondary={getDeletedAgeLabel(project.deleted_at)}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : null}
            </Stack>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Box>
  );
}
