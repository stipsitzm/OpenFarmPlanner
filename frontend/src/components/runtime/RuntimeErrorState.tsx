import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import EmptyStateCard from '../project/EmptyStateCard';
import { useTranslation } from '../../i18n';
import { reloadPage } from '../../runtime/chunkLoadErrors';
import { showsDetailedRuntimeErrors } from '../../config/environment';
import {
  getRuntimeErrorDetails,
  stringifyErrorDetails,
} from '../../runtime/errorDetails';

interface RuntimeErrorStateProps {
  variant: 'applicationUpdated' | 'routeError';
  error?: unknown;
  componentStack?: string;
  layout?: 'page' | 'inline';
}

export default function RuntimeErrorState({
  variant,
  error,
  componentStack,
  layout = 'page',
}: RuntimeErrorStateProps) {
  const { t } = useTranslation('common');
  const isApplicationUpdated = variant === 'applicationUpdated';
  const details = getRuntimeErrorDetails(error, componentStack);

  if (showsDetailedRuntimeErrors && error !== undefined) {
    return (
      <Box
        sx={{
          minHeight: layout === 'page' ? '100vh' : undefined,
          p: 3,
          bgcolor: '#1a1a1a',
          color: '#f5f5f5',
        }}
      >
        <Box sx={{ maxWidth: 960, mx: 'auto' }}>
          <Typography variant="h6" sx={{ color: '#ff6b6b', mb: 1, fontFamily: 'monospace' }}>
            {t('runtime.detailedErrorTitle')}
          </Typography>
          <Typography sx={{ color: '#ffd93d', fontFamily: 'monospace', mb: 2, wordBreak: 'break-word' }}>
            {details.name}: {details.message}
          </Typography>
          {details.errorId ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('runtime.errorId')}: {details.errorId}
            </Alert>
          ) : null}
          {details.stack ? (
            <ErrorDetailBlock title={t('runtime.stackTrace')} value={details.stack} />
          ) : null}
          {details.componentStack ? (
            <ErrorDetailBlock title={t('runtime.componentStack')} value={details.componentStack} />
          ) : null}
          {details.apiDetails ? (
            <ErrorDetailBlock
              title={t('runtime.apiDetails')}
              value={stringifyErrorDetails(details.apiDetails)}
            />
          ) : null}
          <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={reloadPage}>
              {t('runtime.reloadPage')}
            </Button>
            <Button variant="outlined" onClick={() => window.history.back()}>
              {t('runtime.goBack')}
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <EmptyStateCard
        title={t(isApplicationUpdated ? 'runtime.applicationUpdatedTitle' : 'runtime.routeErrorTitle')}
        description={t(isApplicationUpdated ? 'runtime.applicationUpdatedDescription' : 'runtime.routeErrorDescription')}
        actions={[{ label: t('runtime.reloadPage'), onClick: reloadPage }]}
        supplement={details.errorId ? (
          <Typography variant="caption" color="text.secondary">
            {t('runtime.errorId')}: {details.errorId}
          </Typography>
        ) : undefined}
      />
    </Box>
  );
}

function ErrorDetailBlock({ title, value }: { title: string; value: string }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ color: '#ccc', mb: 0.5 }}>
        {title}
      </Typography>
      <Box
        component="pre"
        sx={{
          fontSize: 12,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: '#aaa',
          border: '1px solid #444',
          borderRadius: 1,
          p: 2,
          m: 0,
        }}
      >
        {value}
      </Box>
    </Box>
  );
}
