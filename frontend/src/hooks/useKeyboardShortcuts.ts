import { useEffect } from 'react';

export interface ShortcutKeys {
  alt?: boolean;
  shift?: boolean;
  key: string;
}

export interface ShortcutSpec {
  id: string;
  title: string;
  keys: ShortcutKeys;
  contexts: string[];
  when?: () => boolean;
  action: () => void;
}

const normalizeKey = (key: string): string => {
  if (key.length === 1) {
    return key.toLowerCase();
  }

  return key;
};

const hasModifierMismatch = (event: KeyboardEvent, keys: ShortcutKeys): boolean => {
  const expectedAlt = Boolean(keys.alt);
  const expectedShift = Boolean(keys.shift);

  return (
    event.altKey !== expectedAlt ||
    event.shiftKey !== expectedShift ||
    event.ctrlKey ||
    event.metaKey
  );
};

export const isTypingInEditableElement = (element: Element | null): boolean => {
  if (!element) {
    return false;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true;
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    return true;
  }

  const editableAncestor = element.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]');
  return Boolean(editableAncestor);
};

export const matchesShortcut = (event: KeyboardEvent, keys: ShortcutKeys): boolean => {
  if (hasModifierMismatch(event, keys)) {
    return false;
  }

  return normalizeKey(event.key) === normalizeKey(keys.key);
};

interface UseKeyboardShortcutsOptions {
  currentContexts: string[];
  allowWhenTyping?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutSpec[],
  enabled: boolean,
  options: UseKeyboardShortcutsOptions,
): void {
  const { currentContexts, allowWhenTyping = false } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) {
        return;
      }

      if (!allowWhenTyping && isTypingInEditableElement(document.activeElement)) {
        return;
      }

      const matchedShortcut = shortcuts.find((shortcut) => {
        const inContext = shortcut.contexts.every((context) => currentContexts.includes(context));
        if (!inContext) {
          return false;
        }

        if (shortcut.when && !shortcut.when()) {
          return false;
        }

        return matchesShortcut(event, shortcut.keys);
      });

      if (!matchedShortcut) {
        return;
      }

      event.preventDefault();
      matchedShortcut.action();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [allowWhenTyping, currentContexts, enabled, shortcuts]);
}
