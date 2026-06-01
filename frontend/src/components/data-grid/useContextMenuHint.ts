import { useCallback, useEffect, useState } from 'react';

interface UseContextMenuHintOptions {
  storageKey: string;
  enabled: boolean;
}

interface UseContextMenuHintResult {
  showContextMenuHint: boolean;
  closeContextMenuHint: () => void;
}

export function useContextMenuHint({
  storageKey,
  enabled,
}: UseContextMenuHintOptions): UseContextMenuHintResult {
  const [showContextMenuHint, setShowContextMenuHint] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (window.localStorage.getItem(storageKey) === '1') {
      return;
    }

    window.localStorage.setItem(storageKey, '1');
    setShowContextMenuHint(true);
  }, [enabled, storageKey]);

  const closeContextMenuHint = useCallback((): void => {
    setShowContextMenuHint(false);
  }, []);

  return {
    showContextMenuHint,
    closeContextMenuHint,
  };
}
