import { useEffect } from 'react';

interface SuppressibleEvent {
  preventDefault: () => void;
  stopPropagation: () => void;
}

const editableSelector = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
].join(',');

const customContextMenuSelector = '.ofp-custom-context-menu, [role="menu"]';

export function isEditableContextMenuTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest(editableSelector) !== null;
}

export function shouldOpenCustomContextMenu(target: EventTarget | null): boolean {
  return !isEditableContextMenuTarget(target);
}

export function suppressNativeContextMenu(event: SuppressibleEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

export function useCloseCustomContextMenuOnNativeContextMenu(
  open: boolean,
  onClose: () => void,
  isCustomContextMenuTarget: (target: EventTarget | null) => boolean,
  onOpenMenuContextMenu?: (event: MouseEvent) => void,
): void {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentContextMenu = (event: MouseEvent): void => {
      if (isCustomContextMenuTarget(event.target)) {
        return;
      }

      if (
        event.target instanceof HTMLElement &&
        event.target.closest(customContextMenuSelector) !== null
      ) {
        event.preventDefault();
        event.stopPropagation();
        onOpenMenuContextMenu?.(event);
        return;
      }

      onClose();
    };

    document.addEventListener('contextmenu', handleDocumentContextMenu, true);

    return () => {
      document.removeEventListener('contextmenu', handleDocumentContextMenu, true);
    };
  }, [isCustomContextMenuTarget, onClose, onOpenMenuContextMenu, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0) {
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(customContextMenuSelector) !== null
      ) {
        return;
      }

      onClose();
    };

    document.addEventListener('mousedown', handleDocumentMouseDown, true);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown, true);
    };
  }, [onClose, open]);
}
