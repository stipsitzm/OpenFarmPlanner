import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { CommandProvider } from '../commands/CommandProvider';
import translations from '@/test-utils/translations';
import type { AuthUser } from '../auth/types';

const authState: {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  register: (username: string, password: string, passwordConfirm: string, email?: string) => Promise<void>;
} = {
  user: null,
  isLoading: false,
  login: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  deleteAccount: vi.fn(async () => {}),
  register: vi.fn(async () => {}),
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
    expect(screen.getByRole('link', { name: 'Open App' })).toBeInTheDocument();
  });

  it('renders navigation for authenticated users in /app', async () => {
    authState.user = {
      id: 1,
      username: 'demo',
      email: 'demo@example.com',
      first_name: '',
      last_name: '',
    };
    window.history.pushState({}, '', '/app');

    render(<CommandProvider><App /></CommandProvider>);

    expect(await screen.findByText(translations.navigation.locations)).toBeInTheDocument();
    expect(screen.getByText(translations.navigation.cultures)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: translations.navigation.plantingPlans })).toBeInTheDocument();
  });

  it('redirects unauthenticated users from /app to login', async () => {
    window.history.pushState({}, '', '/app');

    render(<CommandProvider><App /></CommandProvider>);

    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });
});
