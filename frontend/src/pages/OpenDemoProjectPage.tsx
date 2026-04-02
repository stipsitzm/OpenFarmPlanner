import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { projectAPI } from '../api/api';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from '../i18n';

export default function OpenDemoProjectPage(): React.ReactElement {
  const { t } = useTranslation('home');
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const hasTriggeredRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openDemo = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await projectAPI.openDemo();
      const projectId = response.data.project_id;
      if (response.data.created_guest_user || !user) {
        await refreshUser();
      }
      window.localStorage.setItem('activeProjectId', String(projectId));
      navigate('/app/locations', { replace: true });
    } catch {
      setError(t('landing.demoOpenError'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasTriggeredRef.current) {
      return;
    }
    hasTriggeredRef.current = true;
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
