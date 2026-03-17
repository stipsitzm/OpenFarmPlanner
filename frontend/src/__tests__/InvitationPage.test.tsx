import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvitationPage from '../pages/InvitationPage';

const acceptMock = vi.fn(async () => ({ data: { detail: 'ok', project_id: 2 } }));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      acceptInvitation: (...args: unknown[]) => acceptMock(...args),
    },
  };
});

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 } }),
}));

describe('InvitationPage', () => {
  it('accepts invitation token from URL', async () => {
    render(
      <MemoryRouter initialEntries={['/invitation?token=abc123']}>
        <Routes>
          <Route path="/invitation" element={<InvitationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(acceptMock).toHaveBeenCalledWith('abc123'));
    expect(await screen.findByText('Einladung wurde erfolgreich angenommen.')).toBeInTheDocument();
  });
});
