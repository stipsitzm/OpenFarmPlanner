import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ActivatePage from '../pages/auth/ActivatePage';

const activateMock = vi.fn();
const switchActiveProjectMock = vi.fn(async () => {});
const acceptPendingInvitationMock = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    activate: activateMock,
    switchActiveProject: switchActiveProjectMock,
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      acceptPendingInvitation: (...args: unknown[]) => acceptPendingInvitationMock(...args),
    },
  };
});

describe('ActivatePage', () => {
  beforeEach(() => {
    activateMock.mockReset();
    switchActiveProjectMock.mockClear();
    acceptPendingInvitationMock.mockReset();
  });

  it('reads uid and token from query string and triggers activation plus pending invitation acceptance', async () => {
    activateMock.mockResolvedValueOnce(undefined);
    acceptPendingInvitationMock.mockResolvedValueOnce({ data: { code: 'accepted', project_id: 5 } });

    render(
      <MemoryRouter initialEntries={['/activate?uid=MTA&token=abc123']}>
        <Routes>
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/app" element={<div>App</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledWith('MTA', 'abc123');
    });
    await waitFor(() => {
      expect(acceptPendingInvitationMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(switchActiveProjectMock).toHaveBeenCalledWith(5);
    });
  });

  it('shows incomplete-link message only when uid or token is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/activate?uid=MTA']}>
        <Routes>
          <Route path="/activate" element={<ActivatePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Aktivierungslink ist unvollständig.')).toBeTruthy();
    });

    expect(activateMock).not.toHaveBeenCalled();
    expect(acceptPendingInvitationMock).not.toHaveBeenCalled();
  });
});
