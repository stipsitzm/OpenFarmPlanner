import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Space', 'Spacebar']);
const EDITABLE_CONTROL_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
].join(',');
const SPACE_ACTIVATION_SELECTOR = 'button, [role="button"], a[href]';

type DialogScrollKeyboardEvent = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'target' | 'preventDefault' | 'stopImmediatePropagation' | 'stopPropagation'
>;

const getScrollAmount = (key: string, contentElement: HTMLDivElement): number | 'start' | 'end' | null => {
  if (key === 'ArrowDown') {
    return 40;
  }
  if (key === 'ArrowUp') {
    return -40;
  }
  if (key === 'PageDown' || key === ' ' || key === 'Space' || key === 'Spacebar') {
    return Math.max(200, Math.floor(contentElement.clientHeight * 0.9));
  }
  if (key === 'PageUp') {
    return -Math.max(200, Math.floor(contentElement.clientHeight * 0.9));
  }
  if (key === 'Home') {
    return 'start';
  }
  if (key === 'End') {
    return 'end';
  }
  return null;
};

const shouldLetTargetHandleKey = (event: DialogScrollKeyboardEvent): boolean => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return false;
  }

  if (target.closest(EDITABLE_CONTROL_SELECTOR)) {
    return true;
  }

  return (event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar') && Boolean(target.closest(SPACE_ACTIVATION_SELECTOR));
};

const trapKeyboardScroll = (event: DialogScrollKeyboardEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
};

const scrollDialogContent = (event: DialogScrollKeyboardEvent, contentElement: HTMLDivElement): void => {
  if (event.altKey || event.ctrlKey || event.metaKey || !SCROLL_KEYS.has(event.key) || shouldLetTargetHandleKey(event)) {
    return;
  }

  const amount = getScrollAmount(event.key, contentElement);
  if (amount === null) {
    return;
  }

  trapKeyboardScroll(event);

  if (amount === 'start') {
    contentElement.scrollTop = 0;
  } else if (amount === 'end') {
    contentElement.scrollTop = Math.max(0, contentElement.scrollHeight - contentElement.clientHeight);
  } else {
    const maxScrollTop = Math.max(0, contentElement.scrollHeight - contentElement.clientHeight);
    const nextScrollTop = Math.min(maxScrollTop, Math.max(0, contentElement.scrollTop + amount));
    contentElement.scrollTop = nextScrollTop;
  }
};

export const useDialogKeyboardScroll = (open: boolean): RefObject<HTMLDivElement | null> => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const contentElement = contentRef.current;
    if (!contentElement) {
      return;
    }

    const dialogElement = contentElement.closest('[role="dialog"]');
    const activeElement = document.activeElement;
    const hasMeaningfulFocusInsideDialog = Boolean(
      dialogElement
      && activeElement
      && activeElement !== dialogElement
      && dialogElement.contains(activeElement),
    );
    if (!hasMeaningfulFocusInsideDialog) {
      contentElement.focus({ preventScroll: true });
    }

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (!SCROLL_KEYS.has(event.key)) {
        return;
      }

      const activeElement = document.activeElement;
      const isNoElementFocused = !activeElement || activeElement === document.body || activeElement === document.documentElement;
      const isFocusInsideDialog = Boolean(dialogElement && activeElement && dialogElement.contains(activeElement));
      if (!isNoElementFocused && !isFocusInsideDialog) {
        return;
      }

      scrollDialogContent(event, contentElement);
    };

    window.addEventListener('keydown', handleWindowKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleWindowKeyDown, { capture: true });
  }, [open]);

  return contentRef;
};
