import { useCallback, useEffect, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';

export const CONTEXT_MENU_HINT_STORAGE_KEY = 'ofp.contextMenuHintDismissed';

interface UseContextMenuHintOptions {
  enabled?: boolean;
  isDesktop?: boolean;
  isLoading?: boolean;
  hasRows?: boolean;
  storageScopeKey?: string;
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

function getContextMenuHintStorageKey(storageScopeKey?: string): string {
  if (storageScopeKey) {
    return `${CONTEXT_MENU_HINT_STORAGE_KEY}:${storageScopeKey}`;
  }

  const activeProjectId = window.localStorage.getItem('activeProjectId');
  return `${CONTEXT_MENU_HINT_STORAGE_KEY}:project:${activeProjectId ?? 'none'}`;
}

export function useContextMenuHint({
  enabled = true,
  isDesktop,
  isLoading = false,
  hasRows,
  storageScopeKey,
}: UseContextMenuHintOptions): UseContextMenuHintResult {
  const [showContextMenuHint, setShowContextMenuHint] = useState(false);
  const isDesktopPointer = useMediaQuery('(pointer: fine) and (min-width:901px)');
  const resolvedIsDesktop = isDesktop ?? isDesktopPointer;
  const storageKey = getContextMenuHintStorageKey(storageScopeKey);

  useEffect(() => {
    const hasDismissedHint = window.localStorage.getItem(storageKey) === '1';
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
  }, [enabled, hasRows, isLoading, resolvedIsDesktop, storageKey]);

  const closeContextMenuHint = useCallback((): void => {
    window.localStorage.setItem(storageKey, '1');
    setShowContextMenuHint(false);
  }, [storageKey]);

  return {
    showContextMenuHint,
    closeContextMenuHint,
    markContextMenuHintUsed: closeContextMenuHint,
  };
}
