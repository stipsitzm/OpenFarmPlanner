import { Box, Typography } from '@mui/material';
import { useTranslation } from '../../i18n';

interface RuntimeErrorStateProps {
  variant: 'applicationUpdated' | 'routeError';
}

export default function RuntimeErrorState({ variant }: RuntimeErrorStateProps) {
  const { t } = useTranslation('common');
  const isApplicationUpdated = variant === 'applicationUpdated';

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        {t(isApplicationUpdated ? 'runtime.applicationUpdatedFallback' : 'runtime.routeErrorFallback')}
      </Typography>
    </Box>
  );
}
