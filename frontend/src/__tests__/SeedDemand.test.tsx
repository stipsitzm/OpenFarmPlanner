import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SeedDemandPage from '../pages/SeedDemand';
import { CommandProvider } from '../commands/CommandProvider';

const { listMock, saveSelectionMock, cultureListMock, planListMock, locationListMock, fieldListMock, bedListMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  saveSelectionMock: vi.fn(),
  cultureListMock: vi.fn(),
  planListMock: vi.fn(),
  locationListMock: vi.fn(),
  fieldListMock: vi.fn(),
  bedListMock: vi.fn(),
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
    cultureAPI: {
      list: cultureListMock,
    },
    plantingPlanAPI: {
      list: planListMock,
    },
    locationAPI: {
      list: locationListMock,
    },
    fieldAPI: {
      list: fieldListMock,
    },
    bedAPI: {
      list: bedListMock,
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
    window.localStorage.clear();
    projectRequirementState.shouldShowProjectRequiredState = false;
    projectRequirementState.missingProjectReason = null;
    saveSelectionMock.mockResolvedValue({ data: { culture_id: 1, selected_supplier_id: 10 } });
    cultureListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Basis', seed_rate_value: 1, seed_rate_direct_value: null, seed_rate_pre_cultivation_value: null }] },
    });
    planListMock.mockResolvedValue({ data: { results: [{ id: 1 }] } });
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Feld 1', location: 1 }] } });
    bedListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Beet 1' }] } });
  });

  it('shows field-first progressive requirement and no table header when no locations exist', async () => {
    listMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
    locationListMock.mockResolvedValue({ data: { results: [] } });
    fieldListMock.mockResolvedValue({ data: { results: [] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('seedDemand.progressive.fields.title')).toBeInTheDocument();
    });
    expect(screen.queryByText('seedDemand.columns.culture')).not.toBeInTheDocument();
    expect(screen.queryByText('Keine Einträge vorhanden')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common:setupActions.createField' })).toHaveAttribute(
      'href',
      '/app/fields-beds?action=add-parcel',
    );
    expect(screen.queryByRole('link', { name: 'common:setupActions.createBed' })).not.toBeInTheDocument();
  });

  it('shows field-step requirement when a location exists but no fields exist', async () => {
    listMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
    fieldListMock.mockResolvedValue({ data: { results: [] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('seedDemand.progressive.fields.title')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'common:setupActions.createField' })).toHaveAttribute(
      'href',
      '/app/fields-beds?action=add-parcel',
    );
    expect(screen.queryByRole('link', { name: 'common:setupActions.createBed' })).not.toBeInTheDocument();
  });

  it('shows culture-step requirement when locations and beds exist but cultures are missing', async () => {
    listMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
    cultureListMock.mockResolvedValue({ data: { results: [] } });
    planListMock.mockResolvedValue({ data: { results: [] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('seedDemand.progressive.cultures.title')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'common:setupActions.openCultureLibrary' })).toHaveAttribute(
      'href',
      '/app/cultures?library=true',
    );
    expect(screen.getByRole('link', { name: 'common:setupActions.createCulture' })).toHaveAttribute(
      'href',
      '/app/cultures?create=true',
    );
  });

  it('shows plan-step requirement when cultures exist but plans are missing', async () => {
    listMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
    cultureListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Karotte', seed_rate_value: 2, seed_rate_direct_value: null, seed_rate_pre_cultivation_value: null }] },
    });
    planListMock.mockResolvedValue({ data: { results: [] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('seedDemand.progressive.plans.title')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'common:setupActions.createPlan' })).toBeInTheDocument();
  });

  it('shows no-results empty state when requirements are fulfilled but no rows are calculated', async () => {
    listMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
    cultureListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Karotte', seed_rate_value: 2, seed_rate_direct_value: null, seed_rate_pre_cultivation_value: null }] },
    });
    planListMock.mockResolvedValue({ data: { results: [{ id: 1 }] } });

    render(
      <MemoryRouter>
        <CommandProvider>
          <SeedDemandPage />
        </CommandProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('seedDemand.columns.culture')).toBeInTheDocument();
    });
    expect(screen.getByText('seedDemand.emptyStates.noResultsTitle')).toBeInTheDocument();
    expect(screen.getByText('seedDemand.emptyStates.noResultsDescription')).toBeInTheDocument();
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
      '/app/cultures?cultureId=1'
    );

    expect(screen.getByText('25 seedDemand.unitGrams × 8')).toBeInTheDocument();
    expect(screen.queryByText(/Vorschlag:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/over:/i)).not.toBeInTheDocument();
  });

  it('opens row actions from the right-click context menu and copies the visible row as TSV', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
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

    const cultureLink = await screen.findByRole('link', { name: 'Bohne (Canadian Wonder)' });
    const row = cultureLink.closest('tr');
    expect(row).not.toBeNull();

    const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(contextMenuEvent, 'stopPropagation');
    fireEvent(row as HTMLTableRowElement, contextMenuEvent);
    expect(screen.getByRole('menuitem', { name: 'seedDemand.contextMenu.openCulture' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'seedDemand.contextMenu.editCulture' })).toBeInTheDocument();
    expect(contextMenuEvent.defaultPrevented).toBe(true);
    expect(stopPropagationSpy).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'common:actions.copyRow' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'Bohne (Canadian Wonder)\tReinsaat\t184,20 seedDemand.unitGrams\t25 seedDemand.unitGrams × 8',
      );
    });
  });

  it('opens row actions from the inline actions menu', async () => {
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

    await screen.findByRole('link', { name: 'Bohne (Canadian Wonder)' });
    fireEvent.click(screen.getByRole('button', { name: 'common:actions.actions' }));

    expect(screen.getByRole('menuitem', { name: 'seedDemand.contextMenu.openCulture' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'seedDemand.contextMenu.editCulture' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'common:actions.copyRow' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'common:actions.copyTable' })).toBeInTheDocument();
  });

  it('copies the visible seed demand table including headers as TSV', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
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

    const cultureLink = await screen.findByRole('link', { name: 'Salat' });
    const row = cultureLink.closest('tr');
    expect(row).not.toBeNull();

    fireEvent.contextMenu(row as HTMLTableRowElement);
    fireEvent.click(screen.getByRole('menuitem', { name: 'common:actions.copyTable' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        [
          'seedDemand.columns.culture\tseedDemand.columns.supplier\tseedDemand.columns.requiredAmount\tseedDemand.columns.packages',
          'Salat\tReinsaat\t0,25 seedDemand.unitGrams\tseedDemand.noPackagesAvailable',
        ].join('\n'),
      );
    });
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

  it('shows missing TKG guidance instead of a seed total', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            culture_id: 2,
            culture_name: 'Kresse',
            supplier: 'Reinsaat',
            supplier_options: [{ supplier_id: 10, supplier_name: 'Reinsaat' }],
            selected_supplier_id: 10,
            required_amount_value: null,
            required_amount_unit: 'g',
            required_amount_warning: 'missing_tkg',
            total_grams: null,
            package_suggestion: {
              selection: [{ size_value: 1000, size_unit: 'seeds', count: 2 }],
              total_amount: 2000,
              overage: 0,
              pack_count: 2,
              unit: 'seeds',
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

    const cultureLink = await screen.findByRole('link', { name: 'Kresse' });
    expect(screen.getByText('seedDemand.requiredAmountMissingTkg')).toBeInTheDocument();
    expect(screen.queryByText(/2.000,00 seedDemand.unitSeeds/)).not.toBeInTheDocument();

    const row = cultureLink.closest('tr');
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as HTMLTableRowElement);
    fireEvent.click(screen.getByRole('menuitem', { name: 'common:actions.copyRow' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'Kresse\tReinsaat\tseedDemand.requiredAmountMissingTkg\t1.000 seedDemand.unitSeeds × 2',
      );
    });
  });

  it('does not trigger supplier auto-save on initial load', async () => {
    listMock.mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            culture_id: 5,
            culture_name: 'Spinat',
            supplier: 'Only Supplier',
            supplier_options: [{ supplier_id: 10, supplier_name: 'Only Supplier' }],
            selected_supplier_id: 10,
            required_amount_value: 12,
            required_amount_unit: 'g',
            total_grams: 12,
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
      expect(screen.getByText('Spinat')).toBeInTheDocument();
    });
    expect(saveSelectionMock).not.toHaveBeenCalled();
    expect(listMock).toHaveBeenCalledTimes(1);
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

  it('shows read-only supplier state when no suppliers are available', async () => {
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
      expect(screen.getByText('seedDemand.noSupplierAvailable')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'seedDemand.editCultureAction' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'seedDemand.editCultureAction' })).toHaveAttribute(
      'href',
      '/app/cultures?cultureId=4&action=edit',
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows single supplier as read-only without auto-saving selection', async () => {
    listMock.mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            culture_id: 5,
            culture_name: 'Spinat',
            supplier: '',
            selected_supplier_id: null,
            supplier_options: [{ supplier_id: 22, supplier_name: 'Reinsaat' }],
            required_amount_value: 12,
            required_amount_unit: 'g',
            total_grams: 12,
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
      expect(screen.getByText('Spinat')).toBeInTheDocument();
    });
    expect(saveSelectionMock).not.toHaveBeenCalled();
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('seedDemand.noPackagesAvailable')).toBeInTheDocument();
    expect(screen.getByText('Reinsaat')).toBeInTheDocument();
    expect(screen.queryByText('seedDemand.selectSupplier')).not.toBeInTheDocument();
    const supplierSelect = screen.getByRole('combobox');
    expect(supplierSelect).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows placeholder only for rows with multiple suppliers and no selected supplier', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            culture_id: 6,
            culture_name: 'Rote Bete',
            supplier: '',
            selected_supplier_id: null,
            supplier_options: [
              { supplier_id: 30, supplier_name: 'Supplier A' },
              { supplier_id: 31, supplier_name: 'Supplier B' },
            ],
            required_amount_value: 18,
            required_amount_unit: 'g',
            total_grams: 18,
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
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'seedDemand.selectSupplier' })).toBeInTheDocument();
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
