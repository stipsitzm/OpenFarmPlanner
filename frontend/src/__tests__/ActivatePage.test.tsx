import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ActivatePage from '../pages/auth/ActivatePage';

const activateMock = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    activate: activateMock,
  }),
}));

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'activate.incompleteLink') return 'Aktivierungslink ist unvollstaendig.';
      if (key === 'activate.loading') return 'Aktivierung laeuft...';
      if (key === 'activate.success') return 'Aktivierung erfolgreich.';
      if (key === 'activate.failed') return 'Aktivierung fehlgeschlagen.';
      if (key === 'activate.title') return 'Konto aktivieren';
      if (key === 'activate.toLogin') return 'Zum Login';
      return key;
    },
  }),
}));

describe('ActivatePage', () => {
  it('reads uid and token from query string and triggers activation', async () => {
    activateMock.mockResolvedValueOnce(undefined);

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

    expect(screen.queryByText('Aktivierungslink ist unvollstaendig.')).toBeNull();
  });

  it('shows incomplete-link message only when uid or token is missing', async () => {
    activateMock.mockReset();

    render(
      <MemoryRouter initialEntries={['/activate?uid=MTA']}>
        <Routes>
          <Route path="/activate" element={<ActivatePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Aktivierungslink ist unvollstaendig.')).toBeTruthy();
    });

    expect(activateMock).not.toHaveBeenCalled();
  });
});
