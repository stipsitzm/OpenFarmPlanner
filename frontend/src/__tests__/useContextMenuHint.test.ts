import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/authContextShared';
import {
  CONTEXT_MENU_HINT_STORAGE_KEY,
  shouldShowContextMenuHint,
  useContextMenuHint,
} from '../components/data-grid/useContextMenuHint';

const createAuthValue = (userId: number): AuthContextValue => ({
  user: {
    id: userId,
    email: `user-${userId}@example.test`,
    display_name: `User ${userId}`,
    display_label: `User ${userId}`,
    is_active: true,
    default_project_id: null,
    last_project_id: null,
    resolved_project_id: null,
    needs_project_selection: false,
    memberships: [],
    account_pending_deletion: false,
    scheduled_deletion_at: null,
  },
  isLoading: false,
  activeProjectId: null,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  activate: vi.fn(),
  resendActivation: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  requestAccountDeletion: vi.fn(),
  restoreAccount: vi.fn(),
  switchActiveProject: vi.fn(),
  refreshUser: vi.fn(),
});

const createAuthWrapper = (authValue: AuthContextValue) => (
  function AuthWrapper({ children }: { children: ReactNode }) {
    return createElement(AuthContext.Provider, { value: authValue }, children);
  }
);

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

  it('tracks dismissal per authenticated user instead of per browser', async () => {
    window.localStorage.setItem(CONTEXT_MENU_HINT_STORAGE_KEY, '1');
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:1`, '1');

    const { result } = renderHook(() => useContextMenuHint({
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }), {
      wrapper: createAuthWrapper(createAuthValue(2)),
    });

    await waitFor(() => expect(result.current.showContextMenuHint).toBe(true));

    act(() => result.current.closeContextMenuHint());

    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:2`)).toBe('1');
    await waitFor(() => expect(result.current.showContextMenuHint).toBe(false));
  });
});
