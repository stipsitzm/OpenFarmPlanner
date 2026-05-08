import type { ReactElement } from 'react';
import { Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import {
  segmentedToggleButtonGroupSx,
  segmentedToggleButtonSx,
} from './buttons/segmentedControlStyles';

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

function renderToggleButtonWithOptionalTooltip(
  button: ReactElement,
  tooltip?: string,
): ReactElement {
  if (!tooltip) {
    return button;
  }

  return (
    <Tooltip title={tooltip}>
      {button}
    </Tooltip>
  );
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
        sx={segmentedToggleButtonGroupSx}
        onChange={(_, selectedMode: ModeToggleValue | null) => {
          if (selectedMode !== null) {
            onChange(selectedMode);
          }
        }}
      >
        {renderToggleButtonWithOptionalTooltip(
          <ToggleButton value="view" aria-label={viewLabel} sx={segmentedToggleButtonSx}>
            {viewLabel}
          </ToggleButton>,
          viewTooltip,
        )}
        {renderToggleButtonWithOptionalTooltip(
          <ToggleButton value="edit" aria-label={editLabel} sx={segmentedToggleButtonSx}>
            {editLabel}
          </ToggleButton>,
          editTooltip,
        )}
      </ToggleButtonGroup>
    </Stack>
  );
}

export default ModeToggle;
