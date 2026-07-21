import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { AuthProvider } from '../auth/AuthContext';
import { AUTHENTICATION_EXPIRED_EVENT } from '../auth/authEvents';
import { AuthContext } from '../auth/authContextShared';
import type { AuthUser } from '../auth/types';

const baseUser: AuthUser = {
  id: 1,
  email: 'demo@example.com',
  display_name: 'Demo',
  display_label: 'Demo',
  is_active: true,
  default_project_id: 1,
  last_project_id: 1,
  resolved_project_id: 1,
  needs_project_selection: false,
  memberships: [],
  account_pending_deletion: false,
  scheduled_deletion_at: null,
  pending_consents: [],
  public_library_terms_accepted: false,
};

const getMeMock = vi.hoisted(() => vi.fn(async () => baseUser));

vi.mock('../auth/authApi', () => ({
  getMe: getMeMock,
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
}));

function ActiveProjectProbe() {
  const auth = useContext(AuthContext);
  return <div data-testid="active-project-id">{auth?.activeProjectId ?? 'none'}</div>;
}

describe('AuthProvider cross-tab project sync', () => {
  const originalLocation = window.location;

  // jsdom's window.location.reload is a non-configurable, non-writable own property,
  // so it can't be spied on (directly, or via a Proxy — the reload-invariant check
  // rejects a Proxy that reports a different value for it). Replace the whole object
  // instead, and restore the original in afterEach so no other test observes this.
  function stubLocationReload(): ReturnType<typeof vi.fn> {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    return reloadSpy;
  }

  beforeEach(() => {
    localStorage.clear();
    getMeMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('reloads the page when activeProjectId changes in another tab', async () => {
    const reloadSpy = stubLocationReload();

    render(<AuthProvider><ActiveProjectProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('1'));

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'activeProjectId',
      oldValue: '1',
      newValue: '2',
    }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload for unrelated storage keys or unchanged values', async () => {
    const reloadSpy = stubLocationReload();

    render(<AuthProvider><ActiveProjectProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('1'));

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'someOtherKey',
      oldValue: 'a',
      newValue: 'b',
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'activeProjectId',
      oldValue: '1',
      newValue: '1',
    }));

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('clears stale auth state when the shared API client reports an expired session', async () => {
    render(<AuthProvider><ActiveProjectProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('1'));
    expect(localStorage.getItem('activeProjectId')).toBe('1');

    act(() => {
      window.dispatchEvent(new Event(AUTHENTICATION_EXPIRED_EVENT));
    });

    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('none'));
    expect(localStorage.getItem('activeProjectId')).toBeNull();
  });
});
