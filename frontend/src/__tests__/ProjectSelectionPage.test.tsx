import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectSelectionPage from '../pages/ProjectSelectionPage';

const authState = vi.hoisted(() => ({
  user: {
    memberships: [
      { project_id: 1, project_name: 'Alpha', role: 'admin' as const },
      { project_id: 2, project_name: 'Beta', role: 'member' as const },
    ],
  },
  switchActiveProject: vi.fn(async () => {}),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authState,
}));

describe('ProjectSelectionPage', () => {
  beforeEach(() => {
    authState.switchActiveProject.mockClear();
    authState.user = {
      memberships: [
        { project_id: 1, project_name: 'Alpha', role: 'admin' },
        { project_id: 2, project_name: 'Beta', role: 'member' },
      ],
    };
  });

  it('renders projects and open action for existing projects', () => {
    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Mitglied')).toBeInTheDocument();
    expect(screen.getAllByText('Öffnen').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Neues Projekt' })).toBeInTheDocument();
  });

  it('shows a proper empty state and create CTA when no projects exist', () => {
    authState.user = {
      memberships: [],
    };
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);

    expect(screen.getByText('Du hast noch kein Projekt.')).toBeInTheDocument();
    expect(screen.getByText('Lege dein erstes Projekt an, um mit der Planung zu starten.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Erstes Projekt anlegen' }));
    expect(dispatchSpy).toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });
});
