import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { CommandProvider } from '../commands/CommandProvider';
import translations from '@/test-utils/translations';
import type { AuthUser } from '../auth/types';

const authState = {
  user: null as AuthUser | null,
  isLoading: false,
  login: vi.fn(async () => ({}) as AuthUser),
  logout: vi.fn(async () => {}),
  register: vi.fn(async () => 'ok'),
  activate: vi.fn(async () => {}),
  resendActivation: vi.fn(async () => 'ok'),
  requestPasswordReset: vi.fn(async () => 'ok'),
  confirmPasswordReset: vi.fn(async () => 'ok'),
  requestAccountDeletion: vi.fn(async () => ({ detail: 'ok', scheduled_deletion_at: new Date().toISOString() })),
  restoreAccount: vi.fn(async () => ({}) as AuthUser),
};

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('App', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isLoading = false;
    window.history.pushState({}, '', '/');
  });

  it('renders public home page on root path', async () => {
    render(<CommandProvider><App /></CommandProvider>);

    expect(await screen.findByText('OpenFarmPlanner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'App öffnen' })).toBeInTheDocument();
  });

  it('renders navigation for authenticated users in /app', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
    };
    window.history.pushState({}, '', '/app/anbauplaene');

    render(<CommandProvider><App /></CommandProvider>);

    expect(await screen.findByText(translations.navigation.locations)).toBeInTheDocument();
    expect(screen.getByText(translations.navigation.cultures)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translations.navigation.plantingPlans })).toBeInTheDocument();
  });

  it('shows account settings in three-dot menu', async () => {
    authState.user = {
      id: 1,
      email: 'demo@example.com',
      display_name: 'Demo',
      display_label: 'Demo',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
    };
    window.history.pushState({}, '', '/app');

    render(<CommandProvider><App /></CommandProvider>);
    fireEvent.click(await screen.findByLabelText('Mehr'));
    expect(await screen.findByText('Kontoeinstellungen')).toBeInTheDocument();
  });

  it('redirects unauthenticated users from /app to login', async () => {
    window.history.pushState({}, '', '/app');
    render(<CommandProvider><App /></CommandProvider>);
    expect(await screen.findByRole('heading', { name: 'Anmelden' })).toBeInTheDocument();
  });
});
