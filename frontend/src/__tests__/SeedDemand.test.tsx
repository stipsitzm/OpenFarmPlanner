import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SeedDemandPage from '../pages/SeedDemand';
import { CommandProvider } from '../commands/CommandProvider';

const { listMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    seedDemandAPI: {
      list: listMock,
    },
  };
});

describe('SeedDemandPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows culture with variety in parentheses', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            culture_id: 1,
            culture_name: 'Bohne',
            variety: 'Canadian Wonder',
            supplier: 'Reinsaat',
            total_grams: 184.2,
            package_suggestion: {
              selection: [{ size_value: 25, size_unit: 'g', count: 8 }],
              total_amount: 200,
              overage: 15.8,
              pack_count: 8,
            },
            warning: null,
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Bohne (Canadian Wonder)' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Bohne (Canadian Wonder)' })).toHaveAttribute(
      'href',
      '/cultures?cultureId=1'
    );

    expect(screen.getByText('25 g × 8')).toBeInTheDocument();
    expect(screen.queryByText(/Vorschlag:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/over:/i)).not.toBeInTheDocument();
  });

  it('shows compact fallback text when no package suggestion is available', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            culture_id: 2,
            culture_name: 'Salat',
            supplier: 'Reinsaat',
            total_grams: 0.25,
            package_suggestion: null,
            warning: null,
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Keine Packungsgrößen verfügbar')).toBeInTheDocument();
    });
  });
});
