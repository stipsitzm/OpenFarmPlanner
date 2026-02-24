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
            package_size_g: 25,
            packages_needed: 8,
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
  });
});
