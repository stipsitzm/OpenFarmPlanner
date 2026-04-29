import { Box, Button, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import RequirementChecklist from './RequirementChecklist';

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
    <Paper variant="outlined" sx={{ mb: 2, p: 2 }}>
      <Typography variant="subtitle1" sx={{ mb: 0.75, fontWeight: 600 }}>{title}</Typography>
      <Typography variant="body2" sx={{ mb: actions.length > 0 || checklist.length > 0 ? 1.5 : 0 }}>
        {description}
      </Typography>
      {checklist.length > 0 ? <Box sx={{ mb: 1.5 }}><RequirementChecklist items={checklist.map((item) => ({ label: item.label, satisfied: item.done }))} /></Box> : null}
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
    </Paper>
  );
}
