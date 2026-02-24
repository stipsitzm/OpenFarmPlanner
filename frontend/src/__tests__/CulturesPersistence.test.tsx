import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';

const {
  listMock,
  selectedIdHistory,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  selectedIdHistory: [] as Array<number | undefined>,
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: ({ selectedCultureId, onCultureSelect }: {
    selectedCultureId?: number;
    onCultureSelect: (culture: { id?: number } | null) => void;
  }): ReactElement => {
    selectedIdHistory.push(selectedCultureId);

    return (
      <div>
        <span data-testid="selected-culture-id">{selectedCultureId ?? 'none'}</span>
        <button type="button" onClick={() => onCultureSelect({ id: 2 })}>
          select-culture-2
        </button>
      </div>
    );
  },
}));

function SearchIndicator(): ReactElement {
  const location = useLocation();
  return <span data-testid="location-search">{location.search}</span>;
}

function renderCultures(initialEntry = '/cultures'): void {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/cultures"
          element={(
            <>
              <SearchIndicator />
              <CommandProvider><Cultures /></CommandProvider>
            </>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('Cultures selection persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectedIdHistory.length = 0;
    localStorage.clear();

    listMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1 },
          { id: 2, name: 'Kartoffel', growth_duration_days: 1, harvest_duration_days: 1 },
        ],
      },
    });
  });

  it('restores initial selection from query parameter once', async () => {
    localStorage.setItem('selectedCultureId', '2');

    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent('?cultureId=1');
    expect(localStorage.getItem('selectedCultureId')).toBe('1');
    expect(selectedIdHistory).not.toContain(undefined);
  });

  it('persists user selection to url and localStorage', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'select-culture-2' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent('?cultureId=2');
    expect(localStorage.getItem('selectedCultureId')).toBe('2');
  });

  it('restores selection from localStorage when returning without query parameter', async () => {
    localStorage.setItem('selectedCultureId', '2');

    renderCultures('/cultures');

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent('?cultureId=2');
    expect(localStorage.getItem('selectedCultureId')).toBe('2');
  });

  it('does not flip back to previous selection after user change', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'select-culture-2' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const firstSelectionOfTwo = selectedIdHistory.findIndex((value) => value === 2);
    const valuesAfterSelectingTwo = selectedIdHistory.slice(firstSelectionOfTwo);

    expect(firstSelectionOfTwo).toBeGreaterThan(-1);
    expect(valuesAfterSelectingTwo).not.toContain(1);
  });
});
