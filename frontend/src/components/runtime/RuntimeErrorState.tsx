import { Box } from '@mui/material';
import EmptyStateCard from '../project/EmptyStateCard';
import { useTranslation } from '../../i18n';
import { reloadPage } from '../../runtime/chunkLoadErrors';

interface RuntimeErrorStateProps {
  variant: 'applicationUpdated' | 'routeError';
}

export default function RuntimeErrorState({ variant }: RuntimeErrorStateProps) {
  const { t } = useTranslation('common');
  const isApplicationUpdated = variant === 'applicationUpdated';

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <EmptyStateCard
        title={t(isApplicationUpdated ? 'runtime.applicationUpdatedTitle' : 'runtime.routeErrorTitle')}
        description={t(isApplicationUpdated ? 'runtime.applicationUpdatedDescription' : 'runtime.routeErrorDescription')}
        actions={[{ label: t('runtime.reloadPage'), onClick: reloadPage }]}
      />
    </Box>
  );
}
