import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
};

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

describe('AccountSettingsPage', () => {
  it('renders and opens delete dialog with password required', async () => {
    render(<MemoryRouter><AccountSettingsPage /></MemoryRouter>);
    expect(screen.getByText('Kontoeinstellungen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    expect(await screen.findByRole('heading', { name: 'Konto zur Löschung vormerken' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Konto zur Löschung vormerken' })).toBeDisabled();
  });
});
