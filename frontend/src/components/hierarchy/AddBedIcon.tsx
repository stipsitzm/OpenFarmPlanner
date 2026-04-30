import type { MouseEventHandler, ReactElement } from 'react';
import AddIcon from '@mui/icons-material/Add';
import { Box, IconButton, type SxProps, type Theme } from '@mui/material';

interface AddBedIconProps {
  interactive?: boolean;
  ariaLabel?: string;
  ariaHidden?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  sx?: SxProps<Theme>;
}

export function AddBedIcon({
  interactive = true,
  ariaLabel,
  ariaHidden,
  onClick,
  sx,
}: AddBedIconProps): ReactElement {
  const commonSx: SxProps<Theme> = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '1px solid',
    borderColor: 'success.200',
    bgcolor: interactive ? 'transparent' : 'success.50',
    color: 'success.700',
    transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease',
    '& .MuiSvgIcon-root': {
      fontSize: 14,
    },
    ...(interactive
      ? {
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'success.100',
            color: 'success.900',
            borderColor: 'success.300',
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
          verticalAlign: 'text-bottom',
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
