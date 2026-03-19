import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvitationPage from '../pages/InvitationPage';

const getStatusMock = vi.fn(async () => ({ data: { code: 'pending', project_name: 'Alpha', email_masked: 'i***@example.com', requires_auth: false } }));
const acceptMock = vi.fn(async () => ({ data: { code: 'accepted', project_id: 2 } }));

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

const switchActiveProjectMock = vi.fn(async () => {});

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, email: 'invitee@example.com' }, switchActiveProject: switchActiveProjectMock }),
}));

describe('InvitationPage', () => {
  it('shows invitation and accepts it from token route', async () => {
    render(
      <MemoryRouter initialEntries={['/invite/abc123']}>
        <Routes>
          <Route path="/invite/:token" element={<InvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(getStatusMock).toHaveBeenCalledWith('abc123'));
    expect(await screen.findByText('Diese Einladung ist gültig.')).toBeInTheDocument();

    (await screen.findByRole('button', { name: 'Projekt beitreten' })).click();
    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith('abc123'));
    await waitFor(() => expect(switchActiveProjectMock).toHaveBeenCalledWith(2));
  });
});
