import { act, fireEvent, render } from '@testing-library/react';
import { useCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LONG_PRESS_THRESHOLD_MS,
  shouldOpenCustomContextMenu,
  useCloseCustomContextMenuOnNativeContextMenu,
  useLongPress,
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

function LongPressProbe({ onLongPress }: { onLongPress: () => void }) {
  const { onTouchStart, onTouchEnd, onTouchMove, isLongPressing } = useLongPress(onLongPress);

  return (
    <div
      data-testid="press-target"
      data-long-pressing={isLongPressing ? 'true' : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    />
  );
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the context menu after the touch is held past the threshold', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    expect(target).toHaveAttribute('data-long-pressing', 'true');
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not open the context menu on a short tap', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchEnd(target);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(target).not.toHaveAttribute('data-long-pressing');
  });

  it('cancels the long press when the finger moves (scroll/drag)', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchMove(target, { touches: [{ identifier: 1, clientX: 40, clientY: 40 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(target).not.toHaveAttribute('data-long-pressing');
  });

  it('cancels the long press when released just before the threshold', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS - 50);
    });
    fireEvent.touchEnd(target);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
