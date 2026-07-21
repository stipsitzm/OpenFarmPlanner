import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/authContextShared';
import {
  CONTEXT_MENU_HINT_STORAGE_KEY,
  clearContextMenuHintDismissals,
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

  it('shows the hint independently for multiple table contexts', async () => {
    const plantingPlans = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));
    const fieldsBeds = renderHook(() => useContextMenuHint({
      contextKey: 'fieldsBeds',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    await waitFor(() => expect(plantingPlans.result.current.showContextMenuHint).toBe(true));
    await waitFor(() => expect(fieldsBeds.result.current.showContextMenuHint).toBe(true));
  });

  it('hides only the current table context after the row context menu is used', async () => {
    const plantingPlans = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));
    const fieldsBeds = renderHook(() => useContextMenuHint({
      contextKey: 'fieldsBeds',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    await waitFor(() => expect(plantingPlans.result.current.showContextMenuHint).toBe(true));
    await waitFor(() => expect(fieldsBeds.result.current.showContextMenuHint).toBe(true));

    act(() => plantingPlans.result.current.markContextMenuHintUsed());

    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:context:plantingPlans`)).toBe('1');
    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:context:fieldsBeds`)).toBeNull();
    await waitFor(() => expect(plantingPlans.result.current.showContextMenuHint).toBe(false));
    expect(fieldsBeds.result.current.showContextMenuHint).toBe(true);
  });

  it('keeps the per-context dismissal after a reload', async () => {
    const { result, unmount } = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    await waitFor(() => expect(result.current.showContextMenuHint).toBe(true));

    act(() => result.current.markContextMenuHintUsed());
    await waitFor(() => expect(result.current.showContextMenuHint).toBe(false));

    unmount();

    const remountedPlantingPlans = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));
    const remountedFieldsBeds = renderHook(() => useContextMenuHint({
      contextKey: 'fieldsBeds',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    expect(remountedPlantingPlans.result.current.showContextMenuHint).toBe(false);
    await waitFor(() => expect(remountedFieldsBeds.result.current.showContextMenuHint).toBe(true));
  });

  it('hides only the current table context when it is manually closed', async () => {
    const plantingPlans = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));
    const fieldsBeds = renderHook(() => useContextMenuHint({
      contextKey: 'fieldsBeds',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    await waitFor(() => expect(plantingPlans.result.current.showContextMenuHint).toBe(true));
    await waitFor(() => expect(fieldsBeds.result.current.showContextMenuHint).toBe(true));

    act(() => fieldsBeds.result.current.closeContextMenuHint());

    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:context:fieldsBeds`)).toBe('1');
    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:context:plantingPlans`)).toBeNull();
    await waitFor(() => expect(fieldsBeds.result.current.showContextMenuHint).toBe(false));
    expect(plantingPlans.result.current.showContextMenuHint).toBe(true);
  });

  it('ignores legacy global dismissals for context-specific hints', async () => {
    window.localStorage.setItem(CONTEXT_MENU_HINT_STORAGE_KEY, '1');
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:7`, '1');

    const { result } = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }), {
      wrapper: createAuthWrapper(createAuthValue(7)),
    });

    await waitFor(() => expect(result.current.showContextMenuHint).toBe(true));
  });

  it('stores context menu usage for the current table context', async () => {
    const { result } = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    await waitFor(() => expect(result.current.showContextMenuHint).toBe(true));

    act(() => result.current.markContextMenuHintUsed());

    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:context:plantingPlans`)).toBe('1');
    await waitFor(() => expect(result.current.showContextMenuHint).toBe(false));
  });

  it('ignores legacy project-scoped dismissals when the global hint has not been dismissed', async () => {
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:project:123`, '1');

    const { result } = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }));

    expect(window.localStorage.getItem(CONTEXT_MENU_HINT_STORAGE_KEY)).toBeNull();
    await waitFor(() => expect(result.current.showContextMenuHint).toBe(true));
  });

  it('tracks dismissal per authenticated user instead of per browser', async () => {
    window.localStorage.setItem(CONTEXT_MENU_HINT_STORAGE_KEY, '1');
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:1:context:plantingPlans`, '1');

    const { result } = renderHook(() => useContextMenuHint({
      contextKey: 'plantingPlans',
      isDesktop: true,
      isLoading: false,
      hasRows: true,
    }), {
      wrapper: createAuthWrapper(createAuthValue(2)),
    });

    await waitFor(() => expect(result.current.showContextMenuHint).toBe(true));

    act(() => result.current.closeContextMenuHint());

    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:2:context:plantingPlans`)).toBe('1');
    await waitFor(() => expect(result.current.showContextMenuHint).toBe(false));
  });

  it('clears context-specific hint dismissals when account hints are reset', () => {
    window.localStorage.setItem(CONTEXT_MENU_HINT_STORAGE_KEY, '1');
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:context:plantingPlans`, '1');
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:project:123`, '1');
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:7`, '1');
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:7:context:fieldsBeds`, '1');
    window.localStorage.setItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:8:context:fieldsBeds`, '1');

    act(() => clearContextMenuHintDismissals(7));

    expect(window.localStorage.getItem(CONTEXT_MENU_HINT_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:context:plantingPlans`)).toBeNull();
    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:project:123`)).toBeNull();
    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:7`)).toBeNull();
    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:7:context:fieldsBeds`)).toBeNull();
    expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:8:context:fieldsBeds`)).toBe('1');
  });
});
