import { describe, expect, it, vi, beforeEach } from 'vitest';
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
const revokeInvitationMock = vi.fn();

const authState = {
  user: {
    id: 1,
    memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' as const }],
  },
};

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
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
      revokeInvitation: (...args: unknown[]) => revokeInvitationMock(...args),
    },
  };
});

describe('ProjectSettingsPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('activeProjectId', '1');
    authState.user = {
      id: 1,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
    };
    inviteMock.mockClear();
    listMock.mockClear();
    listMembersMock.mockClear();
    updateMemberMock.mockClear();
    removeMemberMock.mockClear();
    revokeInvitationMock.mockClear();
    listMock.mockResolvedValue({ data: [] });
    listMembersMock.mockResolvedValue({
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
    });
  });

  it('invites a user from project settings page', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(listMembersMock).toHaveBeenCalledWith(1));

    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'invitee@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung senden' }));

    await waitFor(() => expect(inviteMock).toHaveBeenCalledWith(1, { email: 'invitee@example.com', role: 'member' }));
  });

  it('updates member roles and removes members from project settings page', async () => {
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

  it('shows a neutral no-access state for invitations when the user is not an admin', async () => {
    authState.user = {
      id: 1,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'member' }],
    };

    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    await waitFor(() => expect(listMembersMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(listMock).not.toHaveBeenCalled());
    expect(await screen.findByText('Nur Admins können Einladungen sehen und verwalten.')).toBeInTheDocument();
    expect(screen.getByText('Nur Admins können Einladungen senden und verwalten.')).toBeInTheDocument();
    expect(screen.queryByText('Es gibt aktuell keine Einladungen.')).not.toBeInTheDocument();
    expect(screen.queryByText('Einladungen konnten nicht geladen werden.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Einladung senden' })).toBeDisabled();
  });

  it('shows invitation load errors only for admins when the API fails', async () => {
    listMock.mockRejectedValueOnce(new Error('boom'));

    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    expect(await screen.findByText('Einladungen konnten nicht geladen werden.')).toBeInTheDocument();
  });
});
