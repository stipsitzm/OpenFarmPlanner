import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../pages/auth/RegisterPage';

const logoutMock = vi.fn(async () => undefined);

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'test@example.com',
      display_name: 'Test',
      display_label: 'test@example.com',
      is_active: true,
      default_project_id: 1,
      last_project_id: 1,
      resolved_project_id: 1,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
    },
    register: vi.fn(),
    resendActivation: vi.fn(),
    logout: logoutMock,
  }),
}));

vi.mock('../api/api', () => ({
  projectAPI: {
    getPendingInvitation: vi.fn(async () => ({ data: { code: 'no_pending_invitation' } })),
  },
}));

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: { user?: string }) => {
      if (key === 'auth:register.loggedInHint') {
        return `Du bist bereits angemeldet als ${params?.user}. Möchtest du einen neuen Account erstellen?`;
      }
      const map: Record<string, string> = {
        'auth:register.title': 'Registrieren',
        'auth:register.logoutAndCreate': 'Abmelden & neuen Account erstellen',
        'auth:register.backToApp': 'Zur App zurückkehren',
        'auth:register.email': 'E-Mail',
        'auth:register.displayName': 'Anzeigename',
        'auth:register.password': 'Passwort',
        'auth:register.passwordConfirm': 'Passwort bestätigen',
        'auth:register.submit': 'Konto erstellen',
        'auth:register.resendActivation': 'Aktivierungs-E-Mail erneut senden',
        'auth:register.hasAccount': 'Bereits ein Konto? Anmelden',
        'auth:register.showPassword': 'Passwort anzeigen',
        'auth:register.hidePassword': 'Passwort verbergen',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    logoutMock.mockClear();
  });

  it('password toggle buttons use translated German aria-labels (BUG-M02 regression guard)', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>,
    );

    const toggleButtons = screen.getAllByRole('button', { name: /Passwort anzeigen/i });
    expect(toggleButtons).toHaveLength(2);
    toggleButtons.forEach((btn) => {
      expect(btn).not.toHaveAttribute('aria-label', 'Show password');
      expect(btn).not.toHaveAttribute('aria-label', 'Hide password');
    });
  });

  it('password fields carry autocomplete="new-password" (BUG-L02 regression guard)', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>,
    );

    const passwordInputs = screen
      .getAllByLabelText(/Passwort/i)
      .filter((el) => el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password');
    expect(passwordInputs.length).toBeGreaterThanOrEqual(1);
    passwordInputs.forEach((input) => {
      expect(input).toHaveAttribute('autocomplete', 'new-password');
    });
  });

  it('shows logged-in info banner and account-switch actions instead of redirecting', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Registrieren')).toBeInTheDocument();
    expect(screen.getByText(/Du bist bereits angemeldet als/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abmelden & neuen Account erstellen' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
