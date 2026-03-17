import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage';
import { AuthApiError } from '../auth/authApi';

const loginMock = vi.fn();
const restoreMock = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    login: loginMock,
    restoreAccount: restoreMock,
  }),
}));

describe('LoginPage deletion flow', () => {
  it('shows restore option for account_pending_deletion', async () => {
    loginMock.mockRejectedValueOnce(new AuthApiError('pending', 'account_pending_deletion', new Date().toISOString()));
    restoreMock.mockResolvedValueOnce({ memberships: [], needs_project_selection: true });

    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'demo@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('button', { name: 'Konto wiederherstellen' })).toBeInTheDocument();
  });
});
