import type { MouseEventHandler, ReactElement } from 'react';
import type { SxProps, Theme } from '@mui/material';
import { HierarchyAddIcon } from './HierarchyAddIcon';

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
  return (
    <HierarchyAddIcon
      interactive={interactive}
      ariaLabel={ariaLabel}
      ariaHidden={ariaHidden}
      onClick={onClick}
      sx={sx}
    />
  );
}
