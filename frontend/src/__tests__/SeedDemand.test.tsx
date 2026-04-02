import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
            required_amount_value: 184.2,
            required_amount_unit: 'g',
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
            required_amount_value: 0.25,
            required_amount_unit: 'g',
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

  it('shows supplier dropdown when multiple suppliers are available', async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              culture_id: 3,
              culture_name: 'Karotte',
              supplier: 'Reinsaat',
              selected_supplier_id: 10,
              supplier_options: [
                { supplier_id: 10, supplier_name: 'Reinsaat' },
                { supplier_id: 11, supplier_name: 'Bingenheimer' },
              ],
              required_amount_value: 55,
              required_amount_unit: 'g',
              total_grams: 55,
              package_suggestion: {
                selection: [{ size_value: 5, size_unit: 'g', count: 1 }, { size_value: 50, size_unit: 'g', count: 1 }],
                total_amount: 55,
                overage: 0,
                pack_count: 2,
              },
              warning: null,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              culture_id: 3,
              culture_name: 'Karotte',
              supplier: 'Bingenheimer',
              selected_supplier_id: 11,
              supplier_options: [
                { supplier_id: 10, supplier_name: 'Reinsaat' },
                { supplier_id: 11, supplier_name: 'Bingenheimer' },
              ],
              required_amount_value: 55,
              required_amount_unit: 'g',
              total_grams: 55,
              package_suggestion: {
                selection: [{ size_value: 25, size_unit: 'g', count: 1 }, { size_value: 100, size_unit: 'g', count: 1 }],
                total_amount: 125,
                overage: 70,
                pack_count: 2,
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
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Bingenheimer' }));

    expect(screen.getByRole('combobox')).toHaveTextContent('Bingenheimer');
  });

  it('shows empty-state supplier text when no supplier data exists', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            culture_id: 4,
            culture_name: 'Mangold',
            supplier: '',
            selected_supplier_id: null,
            supplier_options: [],
            required_amount_value: 4,
            required_amount_unit: 'g',
            total_grams: 4,
            package_suggestion: null,
            warning: 'Keine Lieferantendaten vorhanden.',
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
      expect(screen.getAllByText('Keine Lieferantendaten vorhanden').length).toBeGreaterThan(0);
    });
  });
});
