import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export interface EmptyStateAction {
  label: string;
  to: string;
}

interface EmptyStateCardProps {
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  checklist?: Array<{ label: string; done: boolean }>;
}

export default function EmptyStateCard({
  title,
  description,
  actions = [],
  checklist = [],
}: EmptyStateCardProps): React.ReactElement {
  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <AlertTitle>{title}</AlertTitle>
      <Typography variant="body2" sx={{ mb: actions.length > 0 || checklist.length > 0 ? 1.5 : 0 }}>
        {description}
      </Typography>
      {checklist.length > 0 ? (
        <Stack spacing={0.5} sx={{ mb: 1.5 }}>
          {checklist.map((item) => (
            <Typography key={item.label} variant="body2" color={item.done ? 'success.main' : 'text.secondary'}>
              {item.done ? '✓' : '○'} {item.label}
            </Typography>
          ))}
        </Stack>
      ) : null}
      {actions.length > 0 ? (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {actions.map((action) => (
            <Button
              key={`${action.label}-${action.to}`}
              component={RouterLink}
              to={action.to}
              variant="outlined"
              size="small"
            >
              {action.label}
            </Button>
          ))}
        </Box>
      ) : null}
    </Alert>
  );
}
