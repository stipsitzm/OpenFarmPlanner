import { Box } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';

interface ContentViewControlsProps {
  primaryControls?: ReactNode;
  secondaryControls?: ReactNode;
  actions?: ReactNode;
  sx?: Record<string, unknown>;
}

export default function ContentViewControls({
  primaryControls,
  secondaryControls,
  actions,
  sx,
}: ContentViewControlsProps): ReactElement | null {
  if (!primaryControls && !secondaryControls && !actions) {
    return null;
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        mb: 1,
        ...sx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 36, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {primaryControls}
        {actions ? <Box sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{actions}</Box> : null}
      </Box>
      {secondaryControls ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 36, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {secondaryControls}
        </Box>
      ) : null}
    </Box>
  );
}
