import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import InvitationAcceptPage from '../pages/InvitationAcceptPage';

const switchActiveProjectMock = vi.fn(async () => {});
const acceptInvitationMock = vi.fn();
const mockAuthState = {
  user: null as null | { id: number; email: string },
};

function LocationEcho(): React.ReactElement {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    switchActiveProject: switchActiveProjectMock,
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      acceptInvitation: (...args: unknown[]) => acceptInvitationMock(...args),
    },
  };
});

describe('InvitationAcceptPage', () => {
  beforeEach(() => {
    mockAuthState.user = null;
    switchActiveProjectMock.mockClear();
    acceptInvitationMock.mockReset();
    window.localStorage.clear();
  });

  it('redirects anonymous users to login with a next parameter and stores token fallback', async () => {
    render(
      <MemoryRouter initialEntries={['/invite/accept?token=abc123']}>
        <Routes>
          <Route path="/invite/accept" element={<InvitationAcceptPage />} />
          <Route path="/login" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('/login?next=%2Finvite%2Faccept%3Ftoken%3Dabc123')).toBeInTheDocument();
    });
    expect(window.localStorage.getItem('ofp.invitationAcceptToken')).toBe('abc123');
    expect(window.localStorage.getItem('ofp.invitationAcceptNext')).toBe('/invite/accept?token=abc123');
  });

  it('accepts the invitation for authenticated users and switches the active project', async () => {
    mockAuthState.user = { id: 1, email: 'invitee@example.com' };
    acceptInvitationMock.mockResolvedValueOnce({
      data: {
        code: 'accepted',
        detail: 'Invitation accepted.',
        project_id: 7,
        project: { id: 7, name: 'Projekt Nord', slug: 'projekt-nord' },
      },
    });

    render(
      <MemoryRouter initialEntries={['/invite/accept?token=abc123']}>
        <Routes>
          <Route path="/invite/accept" element={<InvitationAcceptPage />} />
          <Route path="/app" element={<div>App</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(acceptInvitationMock).toHaveBeenCalledWith('abc123');
    });
    await waitFor(() => {
      expect(switchActiveProjectMock).toHaveBeenCalledWith(7);
    });
    expect(await screen.findByText('Du wurdest dem Projekt hinzugefügt.')).toBeInTheDocument();
  });
});
