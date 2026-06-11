import { useEffect, useState } from 'react';
import { Tooltip, type TooltipProps } from '@mui/material';

const FLOATING_DROPDOWN_SELECTOR = [
  '.MuiPopover-root [role="listbox"]',
  '.MuiPopover-root [role="menu"]',
  '.MuiMenu-paper [role="listbox"]',
  '.MuiMenu-paper [role="menu"]',
  '.MuiAutocomplete-popper [role="listbox"]',
  '.MuiPopper-root [role="listbox"]',
  '.MuiPopper-root [role="menu"]',
].join(',');

const hasFloatingDropdown = (): boolean => (
  Boolean(document.querySelector(FLOATING_DROPDOWN_SELECTOR))
);

function useFloatingDropdownOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const updateOpenState = (): void => {
      setOpen(hasFloatingDropdown());
    };

    updateOpenState();

    const observer = new MutationObserver(updateOpenState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'class', 'aria-hidden'],
    });

    document.addEventListener('focusin', updateOpenState);
    document.addEventListener('mousedown', updateOpenState);
    document.addEventListener('keydown', updateOpenState);

    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', updateOpenState);
      document.removeEventListener('mousedown', updateOpenState);
      document.removeEventListener('keydown', updateOpenState);
    };
  }, []);

  return open;
}

export function DropdownAwareTooltip({
  open,
  disableHoverListener,
  disableFocusListener,
  disableTouchListener,
  ...props
}: TooltipProps) {
  const dropdownOpen = useFloatingDropdownOpen();

  return (
    <Tooltip
      {...props}
      open={dropdownOpen ? false : open}
      disableHoverListener={dropdownOpen || disableHoverListener}
      disableFocusListener={dropdownOpen || disableFocusListener}
      disableTouchListener={dropdownOpen || disableTouchListener}
    />
  );
}
