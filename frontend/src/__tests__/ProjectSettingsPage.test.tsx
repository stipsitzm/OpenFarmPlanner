import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectSettingsPage from '../pages/ProjectSettingsPage';

const inviteMock = vi.fn(async () => ({ data: { code: 'invitation_sent', mail_sent: true } }));
const listMock = vi.fn(async () => ({ data: [] }));
const listMembersMock = vi.fn(async () => ({
  data: [
    {
      id: 11,
      user: 2,
      user_email: 'member@example.com',
      user_display_name: 'Member Name',
      project: 1,
      role: 'member',
      created_at: '2026-03-18T08:00:00Z',
    },
  ],
}));
const updateMemberMock = vi.fn(async () => ({ data: { id: 11, role: 'admin' } }));
const removeMemberMock = vi.fn(async () => ({}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
    },
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      invite: (...args: unknown[]) => inviteMock(...args),
      listInvitations: (...args: unknown[]) => listMock(...args),
      listMembers: (...args: unknown[]) => listMembersMock(...args),
      updateMember: (...args: unknown[]) => updateMemberMock(...args),
      removeMember: (...args: unknown[]) => removeMemberMock(...args),
      revokeInvitation: vi.fn(),
    },
  };
});

describe('ProjectSettingsPage', () => {
  it('invites a user from project settings page', async () => {
    window.localStorage.setItem('activeProjectId', '1');
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(listMembersMock).toHaveBeenCalledWith(1));

    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'invitee@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung senden' }));

    await waitFor(() => expect(inviteMock).toHaveBeenCalledWith(1, { email: 'invitee@example.com', role: 'member' }));
  });

  it('updates member roles and removes members from project settings page', async () => {
    window.localStorage.setItem('activeProjectId', '1');
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    await screen.findByText('Member Name');
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(await screen.findByRole('option', { name: 'Admin' }));
    await waitFor(() => expect(updateMemberMock).toHaveBeenCalledWith(1, 11, 'admin'));

    fireEvent.click(screen.getByRole('button', { name: 'Aus Projekt entfernen' }));
    expect(await screen.findByText('Mitglied wirklich entfernen?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt entfernen' }));
    await waitFor(() => expect(removeMemberMock).toHaveBeenCalledWith(1, 11));
  });
});
