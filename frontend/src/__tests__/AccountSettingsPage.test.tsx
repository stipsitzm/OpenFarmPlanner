import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AccountSettingsPage from '../pages/AccountSettingsPage';
import { DEV_ONBOARDING_PREVIEW_STORAGE_KEY } from '../projects/devOnboardingPreview';

const authState = {
  user: {
    id: 1,
    email: 'demo@example.com',
    display_name: 'Demo',
    display_label: 'Demo',
    public_display_name: '',
    is_active: true,
    default_project_id: null,
    last_project_id: null,
    resolved_project_id: null,
    needs_project_selection: false,
    memberships: [],
    account_pending_deletion: false,
    scheduled_deletion_at: null,
  },
  requestAccountDeletion: vi.fn(async () => ({ detail: 'ok', scheduled_deletion_at: new Date().toISOString() })),
  refreshUser: vi.fn(async () => authState.user),
};

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../hooks/useNavigationBlocker', () => ({
  useNavigationBlocker: vi.fn(),
}));

vi.mock('../auth/authApi', () => ({
  updateProfile: vi.fn(async () => ({ detail: 'Profil aktualisiert.', user: authState.user })),
  updatePublicDisplayName: vi.fn(async () => ({ detail: 'Profil aktualisiert.', user: authState.user })),
  requestEmailChange: vi.fn(async () => ({ detail: 'Bestätigungslink gesendet.' })),
  changePassword: vi.fn(async () => ({ detail: 'Passwort geändert.' })),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders compact sections and keeps delete disabled until confirmation phrase is present', async () => {
    render(<MemoryRouter><AccountSettingsPage /></MemoryRouter>);

    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Öffentliches Profil')).toBeInTheDocument();
    expect(screen.getByText('Login & Sicherheit')).toBeInTheDocument();
    expect(screen.getByText('Gefährlicher Bereich')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anzeigename ändern' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Öffentlichen Anzeigenamen ändern' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'E-Mail-Adresse ändern' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passwort ändern' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Neue E-Mail-Adresse')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Neues Passwort')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Konto zur Löschung vormerken' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Aktuelles Passwort'), { target: { value: 'secret' } });
    fireEvent.change(within(dialog).getByLabelText('Bestätigungstext'), { target: { value: 'DELETE' } });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Bestätigungstext'), { target: { value: 'LÖSCHEN' } });
    expect(confirmButton).toBeEnabled();
  });

  it('starts the developer onboarding preview without deleting data', () => {
    localStorage.setItem('activeProjectId', '1');

    render(
      <MemoryRouter initialEntries={['/app/account-settings']}>
        <Routes>
          <Route path="/app/account-settings" element={<><AccountSettingsPage /><LocationProbe /></>} />
          <Route path="/app/project-selection" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Onboarding erneut anzeigen' }));

    expect(localStorage.getItem(DEV_ONBOARDING_PREVIEW_STORAGE_KEY)).toBe('1');
    expect(localStorage.getItem('activeProjectId')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/app/project-selection');
  });
});
