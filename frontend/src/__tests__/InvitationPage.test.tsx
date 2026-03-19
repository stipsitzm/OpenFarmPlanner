import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvitationPage from '../pages/InvitationPage';

const getStatusMock = vi.fn();
const acceptMock = vi.fn();
const logoutMock = vi.fn(async () => {});
const switchActiveProjectMock = vi.fn(async () => {});

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      getInvitationStatus: (...args: unknown[]) => getStatusMock(...args),
      acceptInvitationByToken: (...args: unknown[]) => acceptMock(...args),
    },
  };
});

const authState = {
  user: { id: 1, email: 'invitee@example.com' },
};

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: authState.user,
    logout: logoutMock,
    switchActiveProject: switchActiveProjectMock,
  }),
}));

describe('InvitationPage', () => {
  beforeEach(() => {
    getStatusMock.mockReset();
    acceptMock.mockReset();
    logoutMock.mockClear();
    switchActiveProjectMock.mockClear();
    authState.user = { id: 1, email: 'invitee@example.com' };
  });

  it('accepts a matching invitation automatically for authenticated users', async () => {
    getStatusMock.mockResolvedValue({ data: { code: 'pending', project_name: 'Alpha', email_masked: 'i***@example.com', requires_auth: false } });
    acceptMock.mockResolvedValue({ data: { code: 'accepted', project_id: 2 } });

    render(
      <MemoryRouter initialEntries={['/invite/abc123']}>
        <Routes>
          <Route path="/invite/:token" element={<InvitationPage />} />
          <Route path="/app" element={<div>App</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(getStatusMock).toHaveBeenCalledWith('abc123'));
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith('abc123'));
    await waitFor(() => expect(switchActiveProjectMock).toHaveBeenCalledWith(2));
  });

  it('shows login and register actions for anonymous invited users', async () => {
    authState.user = null;
    getStatusMock.mockResolvedValue({ data: { code: 'pending', project_name: 'Alpha', email_masked: 'i***@example.com', requires_auth: true } });

    render(
      <MemoryRouter initialEntries={['/invite/abc123']}>
        <Routes>
          <Route path="/invite/:token" element={<InvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Diese Einladung ist gültig.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mit eingeladenem Konto anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrieren' })).toBeInTheDocument();
  });

  it('offers account switching when the logged-in email does not match', async () => {
    getStatusMock.mockResolvedValue({ data: { code: 'email_mismatch', project_name: 'Alpha', email_masked: 'i***@example.com', requires_auth: false } });

    render(
      <MemoryRouter initialEntries={['/invite/abc123']}>
        <Routes>
          <Route path="/invite/:token" element={<InvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Diese Einladung ist für eine andere E-Mail-Adresse bestimmt.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mit anderem Konto anmelden' }));
    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
  });
});
