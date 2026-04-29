import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Chip, Stack } from '@mui/material';

interface RequirementChecklistItem {
  label: string;
  satisfied: boolean;
}

interface RequirementChecklistProps {
  items: RequirementChecklistItem[];
}

export default function RequirementChecklist({ items }: RequirementChecklistProps): React.ReactElement {
  return (
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      {items.map((item) => (
        <Stack key={item.label} direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={item.satisfied ? 'success' : 'default'}
            icon={item.satisfied ? <CheckCircleOutlineIcon /> : <ErrorOutlineIcon />}
            label={item.satisfied ? `${item.label} vorhanden` : `${item.label} fehlt`}
          />
        </Stack>
      ))}
    </Stack>
  );
}
