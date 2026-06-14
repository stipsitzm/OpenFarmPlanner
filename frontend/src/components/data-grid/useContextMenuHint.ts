import { useCallback, useEffect, useState } from 'react';

export const CONTEXT_MENU_HINT_STORAGE_KEY = 'ofp.contextMenuHintDismissed';

interface UseContextMenuHintOptions {
  enabled: boolean;
}

interface UseContextMenuHintResult {
  showContextMenuHint: boolean;
  closeContextMenuHint: () => void;
  markContextMenuHintUsed: () => void;
}

export function useContextMenuHint({
  enabled,
}: UseContextMenuHintOptions): UseContextMenuHintResult {
  const [showContextMenuHint, setShowContextMenuHint] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShowContextMenuHint(false);
      return;
    }
    if (window.localStorage.getItem(CONTEXT_MENU_HINT_STORAGE_KEY) === '1') {
      setShowContextMenuHint(false);
      return;
    }

    setShowContextMenuHint(true);
  }, [enabled]);

  const closeContextMenuHint = useCallback((): void => {
    window.localStorage.setItem(CONTEXT_MENU_HINT_STORAGE_KEY, '1');
    setShowContextMenuHint(false);
  }, []);

  return {
    showContextMenuHint,
    closeContextMenuHint,
    markContextMenuHintUsed: closeContextMenuHint,
  };
}
