import { useEffect } from 'react';

interface UseActiveSaveShortcutOptions {
  enabled: boolean;
  disabled?: boolean;
  getActiveElement: () => HTMLElement | null;
  onSave: () => void;
}

const isSaveShortcut = (event: KeyboardEvent): boolean => (
  (event.ctrlKey || event.metaKey)
  && !event.altKey
  && !event.shiftKey
  && event.key.toLowerCase() === 's'
);

export function useActiveSaveShortcut({
  enabled,
  disabled = false,
  getActiveElement,
  onSave,
}: UseActiveSaveShortcutOptions): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isSaveShortcut(event)) {
        return;
      }

      const activeElement = getActiveElement();
      if (!activeElement) {
        return;
      }

      event.preventDefault();

      if (disabled || event.repeat) {
        return;
      }

      onSave();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [disabled, enabled, getActiveElement, onSave]);
}
