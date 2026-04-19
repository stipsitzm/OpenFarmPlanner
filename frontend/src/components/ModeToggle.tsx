import type { ReactElement } from 'react';
import { Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';

export type ModeToggleValue = 'view' | 'edit';

interface ModeToggleProps {
  label: string;
  ariaLabel: string;
  viewLabel: string;
  editLabel: string;
  viewTooltip?: string;
  editTooltip?: string;
  value: ModeToggleValue;
  onChange: (value: ModeToggleValue) => void;
  fullWidth?: boolean;
}

function ModeToggle({
  label,
  ariaLabel,
  viewLabel,
  editLabel,
  viewTooltip,
  editTooltip,
  value,
  onChange,
  fullWidth = true,
}: ModeToggleProps): ReactElement {
  return (
    <Stack spacing={0.5} sx={{ width: fullWidth ? '100%' : 'auto' }}>
      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent={{ xs: 'space-between', sm: 'flex-start' }}>
        <Typography variant="subtitle2">{label}</Typography>
      </Stack>
      <ToggleButtonGroup
        value={value}
        exclusive
        size="small"
        color="primary"
        fullWidth={fullWidth}
        aria-label={ariaLabel}
        onChange={(_, selectedMode: ModeToggleValue | null) => {
          if (selectedMode !== null) {
            onChange(selectedMode);
          }
        }}
      >
        <Tooltip title={viewTooltip ?? ''}>
          <ToggleButton value="view" aria-label={viewLabel}>
            {viewLabel}
          </ToggleButton>
        </Tooltip>
        <Tooltip title={editTooltip ?? ''}>
          <ToggleButton value="edit" aria-label={editLabel}>
            {editLabel}
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Stack>
  );
}

export default ModeToggle;
