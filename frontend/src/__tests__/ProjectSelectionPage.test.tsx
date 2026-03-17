import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProjectSelectionPage from '../pages/ProjectSelectionPage';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      memberships: [
        { project_id: 1, project_name: 'Alpha', role: 'admin' },
        { project_id: 2, project_name: 'Beta', role: 'member' },
      ],
    },
  }),
}));

describe('ProjectSelectionPage', () => {
  it('shows invite action for admin memberships', () => {
    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);
    expect(screen.getByText('Nutzer einladen')).toBeInTheDocument();
  });
});
