import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';

const {
  listMock,
  publicCultureListMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  publicCultureListMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
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

function renderCultures(): void {
  render(
    <MemoryRouter initialEntries={['/cultures']}>
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
  });

  it('shows the public library as a direct visible button and not as a menu item', async () => {
    renderCultures();

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
});
