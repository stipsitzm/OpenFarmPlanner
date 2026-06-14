import { useCallback, useEffect, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';

export const CONTEXT_MENU_HINT_STORAGE_KEY = 'ofp.contextMenuHintDismissed';
const CONTEXT_MENU_HINT_STORAGE_EVENT = 'ofp:context-menu-hint-dismissed';

interface UseContextMenuHintOptions {
  enabled?: boolean;
  isDesktop?: boolean;
  isLoading?: boolean;
  hasRows?: boolean;
}

interface UseContextMenuHintResult {
  showContextMenuHint: boolean;
  closeContextMenuHint: () => void;
  markContextMenuHintUsed: () => void;
}

interface ShouldShowContextMenuHintOptions {
  isDesktop: boolean;
  isLoading: boolean;
  hasRows: boolean;
  hasDismissedHint: boolean;
}

export function shouldShowContextMenuHint({
  isDesktop,
  isLoading,
  hasRows,
  hasDismissedHint,
}: ShouldShowContextMenuHintOptions): boolean {
  return isDesktop && !isLoading && hasRows && !hasDismissedHint;
}

function hasStoredContextMenuHintDismissal(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.localStorage.getItem(CONTEXT_MENU_HINT_STORAGE_KEY) === '1') {
    return true;
  }

  return false;
}

function storeContextMenuHintDismissal(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CONTEXT_MENU_HINT_STORAGE_KEY, '1');
  window.dispatchEvent(new Event(CONTEXT_MENU_HINT_STORAGE_EVENT));
}

export function useContextMenuHint({
  enabled = true,
  isDesktop,
  isLoading = false,
  hasRows,
}: UseContextMenuHintOptions): UseContextMenuHintResult {
  const [showContextMenuHint, setShowContextMenuHint] = useState(false);
  const [hasDismissedHint, setHasDismissedHint] = useState(hasStoredContextMenuHintDismissal);
  const isDesktopPointer = useMediaQuery('(pointer: fine) and (min-width:901px)');
  const resolvedIsDesktop = isDesktop ?? isDesktopPointer;

  useEffect(() => {
    const syncDismissalState = (): void => {
      setHasDismissedHint(hasStoredContextMenuHintDismissal());
    };

    window.addEventListener('storage', syncDismissalState);
    window.addEventListener(CONTEXT_MENU_HINT_STORAGE_EVENT, syncDismissalState);
    return () => {
      window.removeEventListener('storage', syncDismissalState);
      window.removeEventListener(CONTEXT_MENU_HINT_STORAGE_EVENT, syncDismissalState);
    };
  }, []);

  useEffect(() => {
    const resolvedHasRows = hasRows ?? enabled;
    if (!enabled || !shouldShowContextMenuHint({
      isDesktop: resolvedIsDesktop,
      isLoading,
      hasRows: resolvedHasRows,
      hasDismissedHint,
    })) {
      setShowContextMenuHint(false);
      return;
    }

    setShowContextMenuHint(true);
  }, [enabled, hasDismissedHint, hasRows, isLoading, resolvedIsDesktop]);

  const closeContextMenuHint = useCallback((): void => {
    storeContextMenuHintDismissal();
    setHasDismissedHint(true);
    setShowContextMenuHint(false);
  }, []);

  return {
    showContextMenuHint,
    closeContextMenuHint,
    markContextMenuHintUsed: closeContextMenuHint,
  };
}
