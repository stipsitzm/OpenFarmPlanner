import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';

interface CompactAreaCellProps {
  label: string;
}

const TOOLTIP_TEXT_LENGTH_THRESHOLD = 40;

export function shouldShowAreaTooltip(label: string, isOverflowing: boolean): boolean {
  return isOverflowing || label.length > TOOLTIP_TEXT_LENGTH_THRESHOLD;
}

export function CompactAreaCell({ label }: CompactAreaCellProps): React.ReactElement {
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) {
      return;
    }

    const updateOverflow = (): void => {
      setIsOverflowing(element.scrollWidth > element.clientWidth);
    };

    updateOverflow();
    window.addEventListener('resize', updateOverflow);
    return () => {
      window.removeEventListener('resize', updateOverflow);
    };
  }, [label]);

  const showTooltip = useMemo(
    () => shouldShowAreaTooltip(label, isOverflowing),
    [isOverflowing, label],
  );

  return (
    <Tooltip
      title={showTooltip ? label : ''}
      disableHoverListener={!showTooltip}
      disableFocusListener={!showTooltip}
      disableTouchListener={!showTooltip}
      enterTouchDelay={450}
    >
      <Box
        sx={{ width: '100%', minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', height: '100%' }}
        tabIndex={showTooltip ? 0 : -1}
        aria-label={showTooltip ? label : undefined}
      >
        <Typography
          ref={textRef}
          variant="body2"
          noWrap
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}
