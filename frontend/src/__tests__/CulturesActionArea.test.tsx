import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { AxiosError } from 'axios';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';

const {
  listMock,
  publicCultureListMock,
  publishPublicMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  publicCultureListMock: vi.fn(),
  publishPublicMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
      publishPublic: publishPublicMock,
    },
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      list: publicCultureListMock,
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: (): ReactElement => <div data-testid="culture-detail-mock" />,
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'tester@example.com', display_name: 'Tester' },
  }),
}));

function renderCultures(initialPath = '/cultures'): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/cultures"
          element={(
            <CommandProvider><Cultures /></CommandProvider>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('Cultures action area', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1 },
        ],
      },
    });

    publicCultureListMock.mockResolvedValue({
      data: {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    });
    publishPublicMock.mockResolvedValue({
      data: {
        operation: 'created',
        public_culture: { id: 99, name: 'Tomate', version: 1, status: 'published' },
        duplicates: [],
      },
    });
  });

  it('shows the public library as a direct visible button and not as a menu item', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Neue Kultur hinzufügen' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Öffentliche Kulturbibliothek' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));

    expect(screen.getByRole('menuitem', { name: 'JSON exportieren (Alt+J)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Alle Kulturen exportieren (Alt+Shift+J)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'JSON importieren (Alt+I)' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Öffentliche Kulturbibliothek' })).not.toBeInTheDocument();
  });

  it('opens the public library dialog via the direct button', async () => {
    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Öffentliche Kulturbibliothek' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Öffentliche Kulturbibliothek' }));

    await waitFor(() => {
      expect(publicCultureListMock).toHaveBeenCalledTimes(1);
    });
  });

  it('shows duplicate publish warning when backend returns conflict', async () => {
    const duplicateError = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'duplicate_public_culture',
          detail: 'A similar public culture already exists.',
          duplicates: [{ id: 4, name: 'Tomate', variety: 'Roma', version: 1 }],
        },
      },
    } as AxiosError;
    publishPublicMock.mockRejectedValue(duplicateError);

    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Öffentlich veröffentlichen' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Öffentlich veröffentlichen' }));

    await waitFor(() => {
      expect(publishPublicMock).toHaveBeenCalledWith(1);
      expect(screen.getByText('Diese Kultur ist bereits öffentlich vorhanden: Tomate (Roma)')).toBeInTheDocument();
    });
  });

  it('deduplicates duplicate-looking public library entries in the dialog list', async () => {
    publicCultureListMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 11, name: 'Salat', variety: 'Bijella', supplier_name: 'Reinsaat', status: 'published', version: 1, published_at: '2026-03-10T12:00:00Z' },
          { id: 12, name: ' salat ', variety: ' BIJELLA ', seed_supplier: '  rein saat  ', status: 'published', version: 1, published_at: '2026-03-11T12:00:00Z' },
        ],
      },
    });

    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Öffentliche Kulturbibliothek' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Öffentliche Kulturbibliothek' }));

    await waitFor(() => {
      expect(screen.getByText('Salat (Bijella)')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Salat (Bijella)')).toHaveLength(1);
  });

  it('shows update label for cultures linked to an owned public culture', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1, owned_public_culture_id: 77 },
        ],
      },
    });

    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Öffentliche Version aktualisieren' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Öffentlich veröffentlichen' })).not.toBeInTheDocument();
  });
});
