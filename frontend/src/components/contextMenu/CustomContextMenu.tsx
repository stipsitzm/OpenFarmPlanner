import type { KeyboardEventHandler, ReactNode, Ref } from 'react';
import { Menu, type MenuProps } from '@mui/material';

interface CustomContextMenuProps extends Omit<
  MenuProps,
  'anchorPosition' | 'anchorReference' | 'children' | 'hideBackdrop' | 'open' | 'slotProps' | 'sx'
> {
  open: boolean;
  mouseX?: number;
  mouseY?: number;
  anchorEl?: MenuProps['anchorEl'];
  listRef?: Ref<HTMLUListElement>;
  onListKeyDown?: KeyboardEventHandler<HTMLUListElement>;
  children: ReactNode;
}

export function CustomContextMenu({
  open,
  mouseX,
  mouseY,
  anchorEl,
  listRef,
  onListKeyDown,
  children,
  ...menuProps
}: CustomContextMenuProps) {
  const hasAnchorPosition = mouseX !== undefined && mouseY !== undefined;

  return (
    <Menu
      {...menuProps}
      open={open}
      hideBackdrop
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          className: 'ofp-custom-context-menu',
          sx: { pointerEvents: 'auto' },
        },
        ...(listRef || onListKeyDown
          ? {
              list: {
                autoFocus: true,
                ref: listRef,
                onKeyDown: onListKeyDown,
              },
            }
          : {}),
      }}
      anchorEl={anchorEl}
      anchorReference={anchorEl ? 'anchorEl' : 'anchorPosition'}
      anchorPosition={hasAnchorPosition ? { top: mouseY, left: mouseX } : undefined}
    >
      {children}
    </Menu>
  );
}
