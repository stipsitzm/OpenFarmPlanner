import type { MouseEventHandler, ReactElement } from 'react';
import AddIcon from '@mui/icons-material/Add';
import { Box, IconButton, type SxProps, type Theme } from '@mui/material';

interface HierarchyAddIconProps {
  interactive?: boolean;
  ariaLabel?: string;
  ariaHidden?: boolean;
  tabIndex?: number;
  onMouseDown?: MouseEventHandler<HTMLButtonElement>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  sx?: SxProps<Theme>;
}

export function HierarchyAddIcon({
  interactive = true,
  ariaLabel,
  ariaHidden,
  tabIndex,
  onMouseDown,
  onClick,
  sx,
}: HierarchyAddIconProps): ReactElement {
  const commonSx: SxProps<Theme> = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: '1px solid',
    borderColor: 'success.400',
    bgcolor: interactive ? 'transparent' : 'success.50',
    color: 'success.main',
    transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
    '& .MuiSvgIcon-root': {
      fontSize: 12,
    },
    ...(interactive
      ? {
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'success.100',
            color: 'success.dark',
            borderColor: 'success.main',
          },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'success.main',
            outlineOffset: '2px',
          },
        }
      : {
          cursor: 'default',
          pointerEvents: 'none',
        }),
  };

  if (!interactive) {
    return (
      <Box
        component="span"
        aria-hidden={ariaHidden ?? true}
        sx={{
          display: 'inline-flex',
          verticalAlign: 'middle',
          ...commonSx,
          ...sx,
        }}
      >
        <AddIcon />
      </Box>
    );
  }

  return (
    <IconButton
      size="small"
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      onMouseDown={onMouseDown}
      onClick={onClick}
      sx={{
        p: 0,
        ...commonSx,
        ...sx,
      }}
    >
      <AddIcon />
    </IconButton>
  );
}
