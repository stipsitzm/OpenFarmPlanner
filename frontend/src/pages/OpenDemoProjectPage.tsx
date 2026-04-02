import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { projectAPI } from '../api/api';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../i18n';

export default function OpenDemoProjectPage(): React.ReactElement {
  const { t } = useTranslation('home');
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openDemo = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await projectAPI.openDemo();
      const projectId = response.data.project_id;
      window.localStorage.setItem('activeProjectId', String(projectId));
      await refreshUser();
      navigate('/app/locations', { replace: true });
    } catch {
      setError(t('landing.demoOpenError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void openDemo();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2} alignItems="flex-start">
        <Typography variant="h5">{t('landing.demoOpeningTitle')}</Typography>
        <Typography color="text.secondary">{t('landing.demoOpeningBody')}</Typography>
        {isLoading ? <CircularProgress size={24} /> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {!isLoading && error ? (
          <Button variant="contained" onClick={() => void openDemo()}>
            {t('landing.demoRetry')}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
