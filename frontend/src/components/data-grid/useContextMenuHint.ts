import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { AuthContext } from '../../auth/authContextShared';

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

function getContextMenuHintStorageKey(userId?: number | null): string {
  if (userId !== undefined && userId !== null) {
    return `${CONTEXT_MENU_HINT_STORAGE_KEY}:user:${userId}`;
  }

  return CONTEXT_MENU_HINT_STORAGE_KEY;
}

function hasStoredContextMenuHintDismissal(storageKey: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.localStorage.getItem(storageKey) === '1') {
    return true;
  }

  return false;
}

function storeContextMenuHintDismissal(storageKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, '1');
  window.dispatchEvent(new Event(CONTEXT_MENU_HINT_STORAGE_EVENT));
}

export function useContextMenuHint({
  enabled = true,
  isDesktop,
  isLoading = false,
  hasRows,
}: UseContextMenuHintOptions): UseContextMenuHintResult {
  const authContext = useContext(AuthContext);
  const storageKey = useMemo(
    () => getContextMenuHintStorageKey(authContext?.user?.id),
    [authContext?.user?.id],
  );
  const [showContextMenuHint, setShowContextMenuHint] = useState(false);
  const [hasDismissedHint, setHasDismissedHint] = useState(() => hasStoredContextMenuHintDismissal(storageKey));
  const isDesktopPointer = useMediaQuery('(pointer: fine) and (min-width:901px)');
  const resolvedIsDesktop = isDesktop ?? isDesktopPointer;

  useEffect(() => {
    const syncDismissalState = (): void => {
      setHasDismissedHint(hasStoredContextMenuHintDismissal(storageKey));
    };

    syncDismissalState();
    window.addEventListener('storage', syncDismissalState);
    window.addEventListener(CONTEXT_MENU_HINT_STORAGE_EVENT, syncDismissalState);
    return () => {
      window.removeEventListener('storage', syncDismissalState);
      window.removeEventListener(CONTEXT_MENU_HINT_STORAGE_EVENT, syncDismissalState);
    };
  }, [storageKey]);

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
    storeContextMenuHintDismissal(storageKey);
    setHasDismissedHint(true);
    setShowContextMenuHint(false);
  }, [storageKey]);

  return {
    showContextMenuHint,
    closeContextMenuHint,
    markContextMenuHintUsed: closeContextMenuHint,
  };
}
