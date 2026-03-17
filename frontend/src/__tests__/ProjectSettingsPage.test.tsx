import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectSettingsPage from '../pages/ProjectSettingsPage';

const inviteMock = vi.fn(async () => ({ data: { mail_sent: true } }));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
    },
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      invite: (...args: unknown[]) => inviteMock(...args),
    },
  };
});

describe('ProjectSettingsPage', () => {
  it('invites a user from project settings page', async () => {
    window.localStorage.setItem('activeProjectId', '1');
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'invitee@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung senden' }));
    expect(inviteMock).toHaveBeenCalledWith(1, { email: 'invitee@example.com', role: 'member' });
  });
});
