import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccountSettingsPage from '../pages/AccountSettingsPage';

const authState = {
  user: {
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
  },
  requestAccountDeletion: vi.fn(async () => ({ detail: 'ok', scheduled_deletion_at: new Date().toISOString() })),
  refreshUser: vi.fn(async () => authState.user),
};

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../auth/authApi', () => ({
  updateProfile: vi.fn(async () => ({ detail: 'Profil aktualisiert.', user: authState.user })),
  requestEmailChange: vi.fn(async () => ({ detail: 'Bestätigungslink gesendet.' })),
  changePassword: vi.fn(async () => ({ detail: 'Passwort geändert.' })),
}));

describe('AccountSettingsPage', () => {
  it('renders all sections and keeps delete disabled until confirmation phrase is present', async () => {
    render(<MemoryRouter><AccountSettingsPage /></MemoryRouter>);

    expect(screen.getByText('Profil')).toBeInTheDocument();
    expect(screen.getByText('Login & Sicherheit')).toBeInTheDocument();
    expect(screen.getByText('Gefährlicher Bereich')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Konto zur Löschung vormerken' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Aktuelles Passwort'), { target: { value: 'secret' } });
    fireEvent.change(within(dialog).getByLabelText('Bestätigungstext'), { target: { value: 'LÖSCHEN' } });
    expect(confirmButton).toBeEnabled();
  });
});
