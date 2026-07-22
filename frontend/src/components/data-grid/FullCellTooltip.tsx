import { useState, type ReactNode } from 'react';
import { Box, Tooltip, type SxProps, type Theme, type TooltipProps } from '@mui/material';

export const FULL_CELL_TOOLTIP_CELL_CLASS = 'ofp-cell-full-tooltip';

export interface FullCellTooltipProps
  extends Pick<TooltipProps, 'title' | 'describeChild' | 'disableInteractive' | 'enterDelay' | 'slotProps'> {
  children: ReactNode;
  cellHasFocus?: boolean;
  triggerSx?: SxProps<Theme>;
}

export function FullCellTooltip({
  children,
  cellHasFocus = false,
  triggerSx,
  ...tooltipProps
}: FullCellTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Tooltip
      {...tooltipProps}
      open={cellHasFocus || isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
    >
      <Box
        component="span"
        className="ofp-full-cell-tooltip-trigger"
        sx={[
          {
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            px: 1.25,
          },
          ...(Array.isArray(triggerSx) ? triggerSx : [triggerSx]),
        ]}
      >
        {children}
      </Box>
    </Tooltip>
  );
}
