import { Box, Button, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import RequirementChecklist from './RequirementChecklist';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export interface EmptyStateAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface EmptyStateCardProps {
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  checklist?: Array<{ label: string; done: boolean; doneLabel?: string; missingLabel?: string }>;
  showInfoIcon?: boolean;
}

export default function EmptyStateCard({
  title,
  description,
  actions = [],
  checklist = [],
  showInfoIcon = true,
}: EmptyStateCardProps): React.ReactElement {
  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        p: 2,
        width: '100%',
        maxWidth: 880,
        borderColor: 'divider',
        backgroundColor: 'grey.50',
        borderLeft: 4,
        borderLeftColor: 'primary.main',
        boxShadow: 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
        {showInfoIcon ? <InfoOutlinedIcon fontSize="small" color="primary" /> : null}
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
      </Box>
      <Typography variant="body2" sx={{ mb: actions.length > 0 || checklist.length > 0 ? 1.5 : 0 }}>
        {description}
      </Typography>
      {checklist.length > 0 ? (
        <Box sx={{ mb: 1.5 }}>
          <RequirementChecklist
            items={checklist.map((item) => ({
              label: item.label,
              satisfied: item.done,
              satisfiedLabel: item.doneLabel,
              missingLabel: item.missingLabel,
            }))}
          />
        </Box>
      ) : null}
      {actions.length > 0 ? (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
          {actions.map((action, index) => (
            <Button
              key={`${action.label}-${action.to}`}
              component={action.to ? RouterLink : 'button'}
              to={action.to}
              onClick={action.onClick}
              variant={index === 0 ? 'contained' : 'outlined'}
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
