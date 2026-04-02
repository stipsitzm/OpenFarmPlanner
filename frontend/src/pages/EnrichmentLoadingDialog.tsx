import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  Typography,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

type Translator = (key: string, options?: Record<string, unknown>) => string;

type EnrichmentStep = {
  key: string;
  startSeconds: number;
};

type EnrichmentLoadingDialogProps = {
  open: boolean;
  elapsedSeconds: number;
  progressPercent: number;
  activeStepIndex: number;
  steps: readonly EnrichmentStep[];
  t: Translator;
};

export function EnrichmentLoadingDialog({
  open,
  elapsedSeconds,
  progressPercent,
  activeStepIndex,
  steps,
  t,
}: EnrichmentLoadingDialogProps): React.ReactElement {
  return (
    <Dialog open={open} aria-labelledby="enrichment-loading-title" maxWidth="xs" fullWidth>
      <DialogTitle id="enrichment-loading-title">{t('ai.loadingTitle')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, mb: 1 }}>
          <CircularProgress size={22} />
          <Typography>{t('ai.loadingText')}</Typography>
        </Box>
        <LinearProgress variant="determinate" value={progressPercent} sx={{ mb: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {t('ai.loadingElapsed', { seconds: elapsedSeconds, percent: progressPercent })}
        </Typography>
        <List dense sx={{ mt: 1 }}>
          {steps.map((step, index) => {
            const isDone = elapsedSeconds >= step.startSeconds && index < activeStepIndex;
            const isActive = index === activeStepIndex;
            const StepIcon = isDone ? CheckCircleOutlineIcon : isActive ? AutorenewIcon : RadioButtonUncheckedIcon;
            return (
              <ListItem key={step.key} sx={{ px: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StepIcon fontSize="small" color={isDone ? 'success' : isActive ? 'primary' : 'disabled'} />
                  <Typography variant="body2" color={isActive ? 'text.primary' : 'text.secondary'}>
                    {t(`ai.loadingSteps.${step.key}`)}
                  </Typography>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
}
