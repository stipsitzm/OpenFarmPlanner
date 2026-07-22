import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { AuthContext } from '../../auth/authContextShared';

export const CONTEXT_MENU_HINT_STORAGE_KEY = 'ofp.contextMenuHintDismissed';
const CONTEXT_MENU_HINT_STORAGE_EVENT = 'ofp:context-menu-hint-dismissed';

interface UseContextMenuHintOptions {
  contextKey: string;
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

function normalizeContextMenuHintKey(contextKey: string): string {
  const normalizedContextKey = contextKey.trim();
  return normalizedContextKey.length > 0 ? normalizedContextKey : 'default';
}

function getContextMenuHintStorageKey(contextKey: string, userId?: number | null): string {
  const normalizedContextKey = normalizeContextMenuHintKey(contextKey);

  if (userId !== undefined && userId !== null) {
    return `${CONTEXT_MENU_HINT_STORAGE_KEY}:user:${userId}:context:${normalizedContextKey}`;
  }

  return `${CONTEXT_MENU_HINT_STORAGE_KEY}:context:${normalizedContextKey}`;
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

function storeContextMenuHintDismissal(storageKey: string, notifyCurrentPage = true): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, '1');
  if (notifyCurrentPage) {
    window.dispatchEvent(new Event(CONTEXT_MENU_HINT_STORAGE_EVENT));
  }
}

export function clearContextMenuHintDismissals(userId?: number | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const removableKeys = new Set<string>([CONTEXT_MENU_HINT_STORAGE_KEY]);
  const contextPrefixes = [
    `${CONTEXT_MENU_HINT_STORAGE_KEY}:context:`,
    `${CONTEXT_MENU_HINT_STORAGE_KEY}:project:`,
  ];

  if (userId !== undefined && userId !== null) {
    removableKeys.add(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:${userId}`);
    contextPrefixes.push(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:${userId}:context:`);
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    if (contextPrefixes.some((prefix) => key.startsWith(prefix))) {
      removableKeys.add(key);
    }
  }

  removableKeys.forEach((key) => window.localStorage.removeItem(key));
  window.dispatchEvent(new Event(CONTEXT_MENU_HINT_STORAGE_EVENT));
}

export function useContextMenuHint({
  contextKey,
  enabled = true,
  isDesktop,
  isLoading = false,
  hasRows,
}: UseContextMenuHintOptions): UseContextMenuHintResult {
  const authContext = useContext(AuthContext);
  const storageKey = useMemo(
    () => getContextMenuHintStorageKey(contextKey, authContext?.user?.id),
    [authContext?.user?.id, contextKey],
  );
  const [hasDismissedHint, setHasDismissedHint] = useState(() => hasStoredContextMenuHintDismissal(storageKey));
  const isDesktopPointer = useMediaQuery('(pointer: fine) and (min-width:901px)');
  const resolvedIsDesktop = isDesktop ?? isDesktopPointer;
  const resolvedHasRows = hasRows ?? enabled;
  const showContextMenuHint = enabled && shouldShowContextMenuHint({
    isDesktop: resolvedIsDesktop,
    isLoading,
    hasRows: resolvedHasRows,
    hasDismissedHint,
  });

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

  const markContextMenuHintUsed = useCallback((): void => {
    storeContextMenuHintDismissal(storageKey, false);
  }, [storageKey]);

  const closeContextMenuHint = useCallback((): void => {
    storeContextMenuHintDismissal(storageKey);
    setHasDismissedHint(true);
  }, [storageKey]);

  return {
    showContextMenuHint,
    closeContextMenuHint,
    markContextMenuHintUsed,
  };
}
