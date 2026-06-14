import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONTEXT_MENU_HINT_STORAGE_KEY,
  shouldShowContextMenuHint,
  useContextMenuHint,
} from '../components/data-grid/useContextMenuHint';

describe('useContextMenuHint', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the hint only for eligible desktop tables that have not been dismissed', () => {
    expect(shouldShowContextMenuHint({
      isDesktop: true,
      isLoading: false,
      hasRows: true,
      hasDismissedHint: false,
    })).toBe(true);
    expect(shouldShowContextMenuHint({
      isDesktop: false,
      isLoading: false,
      hasRows: true,
      hasDismissedHint: false,
    })).toBe(false);
    expect(shouldShowContextMenuHint({
      isDesktop: true,
      isLoading: true,
      hasRows: true,
      hasDismissedHint: false,
    })).toBe(false);
    expect(shouldShowContextMenuHint({
      isDesktop: true,
      isLoading: false,
      hasRows: false,
      hasDismissedHint: false,
    })).toBe(false);
    expect(shouldShowContextMenuHint({
      isDesktop: true,
      isLoading: false,
      hasRows: true,
      hasDismissedHint: true,
    })).toBe(false);
  });

  it('stores dismissal globally when the hint is closed or used', async () => {
    const { result } = renderHook(() => useContextMenuHint({
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    await waitFor(() => expect(result.current.showContextMenuHint).toBe(true));

    act(() => result.current.markContextMenuHintUsed());

    expect(window.localStorage.getItem(CONTEXT_MENU_HINT_STORAGE_KEY)).toBe('1');
    await waitFor(() => expect(result.current.showContextMenuHint).toBe(false));
  });

  it('ignores legacy project-scoped dismissals when the global hint has not been dismissed', async () => {
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:project:123`, '1');

    const { result } = renderHook(() => useContextMenuHint({
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    expect(window.localStorage.getItem(CONTEXT_MENU_HINT_STORAGE_KEY)).toBeNull();
    await waitFor(() => expect(result.current.showContextMenuHint).toBe(true));
  });
});
