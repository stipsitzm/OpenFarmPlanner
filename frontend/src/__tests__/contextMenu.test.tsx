import { fireEvent, render } from '@testing-library/react';
import { useCallback } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  shouldOpenCustomContextMenu,
  useCloseCustomContextMenuOnNativeContextMenu,
} from '../utils/contextMenu';

function ContextMenuBoundary({
  open,
  onClose,
  onOpenMenuContextMenu,
}: {
  open: boolean;
  onClose: () => void;
  onOpenMenuContextMenu?: (event: MouseEvent) => void;
}) {
  const isCustomContextMenuTarget = useCallback((target: EventTarget | null): boolean => (
    target instanceof HTMLElement && target.closest('[data-custom-context-menu-target]') !== null
  ), []);

  useCloseCustomContextMenuOnNativeContextMenu(
    open,
    onClose,
    isCustomContextMenuTarget,
    onOpenMenuContextMenu,
  );

  return (
    <>
      <div data-testid="custom-target" data-custom-context-menu-target="true" />
      <div data-testid="native-target" />
      <div role="menu" data-testid="open-menu" />
    </>
  );
}

describe('context menu helpers', () => {
  it('keeps native context menus available for editable targets', () => {
    const input = document.createElement('input');

    expect(shouldOpenCustomContextMenu(input)).toBe(false);
  });

  it('does not close the custom menu when right-clicking another supported target', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<ContextMenuBoundary open onClose={onClose} />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    fireEvent(getByTestId('custom-target'), event);

    expect(event.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes the custom menu without suppressing the browser menu on unsupported targets', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<ContextMenuBoundary open onClose={onClose} />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    fireEvent(getByTestId('native-target'), event);

    expect(event.defaultPrevented).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('suppresses the browser menu and repositions when right-clicking the open custom menu itself', () => {
    const onClose = vi.fn();
    const onOpenMenuContextMenu = vi.fn();
    const { getByTestId } = render(
      <ContextMenuBoundary
        open
        onClose={onClose}
        onOpenMenuContextMenu={onOpenMenuContextMenu}
      />,
    );
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    fireEvent(getByTestId('open-menu'), event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenMenuContextMenu).toHaveBeenCalledTimes(1);
  });
});
