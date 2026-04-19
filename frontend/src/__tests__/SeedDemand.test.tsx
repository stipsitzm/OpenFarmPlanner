import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SeedDemandPage from '../pages/SeedDemand';
import { CommandProvider } from '../commands/CommandProvider';

const { listMock, saveSelectionMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  saveSelectionMock: vi.fn(),
}));
const projectRequirementState = vi.hoisted(() => ({
  shouldShowProjectRequiredState: false,
  missingProjectReason: null as null | 'no_projects' | 'no_active_project',
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    seedDemandAPI: {
      list: listMock,
      saveSupplierSelection: saveSelectionMock,
    },
  };
});

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => projectRequirementState,
}));

describe('SeedDemandPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectRequirementState.shouldShowProjectRequiredState = false;
    projectRequirementState.missingProjectReason = null;
    saveSelectionMock.mockResolvedValue({ data: { culture_id: 1, selected_supplier_id: 10 } });
  });

  it('shows project-required info instead of a technical error when no project exists', async () => {
    projectRequirementState.shouldShowProjectRequiredState = true;
    projectRequirementState.missingProjectReason = 'no_projects';

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('projectRequired.noProjectsTitle')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'projectRequired.createProjectAction' })).toBeInTheDocument();
    expect(screen.queryByText('seedDemand.loadError')).not.toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('still shows a load error for real API failures with active project context', async () => {
    listMock.mockRejectedValueOnce(new Error('network failed'));

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('seedDemand.loadError')).toBeInTheDocument();
    });
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
            supplier_options: [{ supplier_id: 10, supplier_name: 'Reinsaat' }],
            selected_supplier_id: 10,
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

    expect(screen.getByText('25 seedDemand.unitGrams × 8')).toBeInTheDocument();
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
            supplier_options: [{ supplier_id: 10, supplier_name: 'Reinsaat' }],
            selected_supplier_id: 10,
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
      expect(screen.getByText('seedDemand.noPackagesAvailable')).toBeInTheDocument();
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

    await waitFor(() => {
      expect(saveSelectionMock).toHaveBeenCalledWith(3, 11);
      expect(listMock).toHaveBeenCalledTimes(2);
    });
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
      expect(screen.getAllByText('seedDemand.noSupplierData').length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: 'seedDemand.editCultureAction' })).toBeInTheDocument();
    });
  });

  it('renders exactly one row per culture in seed demand table', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            culture_id: 10,
            culture_name: 'Karotte',
            supplier_options: [{ supplier_id: 1, supplier_name: 'Supplier A' }],
            selected_supplier_id: 1,
            required_amount_value: 20,
            required_amount_unit: 'g',
            total_grams: 20,
            package_suggestion: null,
            warning: null,
          },
          {
            culture_id: 11,
            culture_name: 'Salat',
            supplier_options: [{ supplier_id: 2, supplier_name: 'Supplier B' }],
            selected_supplier_id: 2,
            required_amount_value: 10,
            required_amount_unit: 'g',
            total_grams: 10,
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
      expect(screen.getByRole('row', { name: /Karotte/i })).toBeInTheDocument();
      expect(screen.getByRole('row', { name: /Salat/i })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
});
