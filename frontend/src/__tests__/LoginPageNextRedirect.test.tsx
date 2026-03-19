import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage';

const loginMock = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    login: loginMock,
    restoreAccount: vi.fn(),
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      getPendingInvitation: vi.fn(async () => ({ data: { code: 'no_pending_invitation', requires_auth: true } })),
    },
  };
});

describe('LoginPage next redirect', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('redirects to the next URL after successful login', async () => {
    loginMock.mockResolvedValueOnce({
      memberships: [{ project_id: 4, project_name: 'Projekt', role: 'member' }],
      needs_project_selection: false,
    });

    render(
      <MemoryRouter initialEntries={['/login?next=/invite/accept?token=abc123']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/accept" element={<div>Accept route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: 'invitee@example.com' } });
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'pass12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(screen.getByText('Accept route')).toBeInTheDocument();
    });
  });
});
