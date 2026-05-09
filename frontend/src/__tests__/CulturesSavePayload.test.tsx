import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';
import type { Culture } from '../api/types';

const { listMock, updateMock, createMock, saveCultureMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  updateMock: vi.fn(),
  createMock: vi.fn(),
  saveCultureMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
      update: updateMock,
      create: createMock,
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: ({
    cultures,
    selectedCultureId,
    onCultureSelect,
    onEditCulture,
    onCreateCulture,
  }: {
    cultures: Culture[];
    selectedCultureId?: number;
    onCultureSelect: (culture: Culture | null) => void;
    onEditCulture?: (culture: Culture) => void;
    onCreateCulture?: () => void;
  }): ReactElement => (
    <div>
      <button
        type="button"
        onClick={() => onCultureSelect({
          id: 1,
          name: 'Karotte',
          variety: 'Nantaise',
          supplier: { id: 10, name: 'Bingenheimer' },
          row_spacing_cm: 20,
          row_spacing_m: 0.2,
        } as Culture)}
      >
        select-culture
      </button>
      <div data-testid="culture-list">{cultures.map((culture) => culture.name).join(', ')}</div>
      <div data-testid="selected-culture-id">{selectedCultureId ?? 'none'}</div>
      <button type="button" onClick={() => onCreateCulture?.()}>Kultur hinzufügen</button>
      <button type="button" onClick={() => cultures[0] && onEditCulture?.(cultures[0])}>Kultur bearbeiten</button>
    </div>
  ),
}));

vi.mock('../cultures/CultureForm', () => ({
  CultureForm: ({ onSave }: { onSave: (culture: Culture) => Promise<void> }): ReactElement => (
    <button
      type="button"
      onClick={() => void onSave(saveCultureMock())}
    >
      submit-edit
    </button>
  ),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'tester@example.com', display_name: 'Tester' },
  }),
}));

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => ({
    shouldShowProjectRequiredState: false,
    missingProjectReason: null,
  }),
}));

describe('Cultures save payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Karotte', variety: 'Nantaise', supplier: { id: 10, name: 'Bingenheimer' } },
        ],
      },
    });

    updateMock.mockResolvedValue({
      data: { id: 1, name: 'Karotte', variety: 'Nantaise' },
    });
    createMock.mockResolvedValue({
      data: { id: 2, name: 'Neue Kultur', variety: 'Nova' },
    });
  });

  it('strips legacy meter spacing fields and normalizes seed_rate_unit (g per plant)', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier: { id: 10, name: 'Bingenheimer' },
      row_spacing_cm: 35,
      row_spacing_m: 0.2,
      seed_rate_unit: 'g per plant' as unknown as Culture['seed_rate_unit'],
    } as Culture);

    render(
      <MemoryRouter>
        <CommandProvider>
          <Cultures />
        </CommandProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));

    const payload = updateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.row_spacing_cm).toBe(35);
    expect(payload.row_spacing_m).toBeUndefined();
    expect(payload.distance_within_row_m).toBeUndefined();
    expect(payload.sowing_depth_m).toBeUndefined();
    expect(payload.seed_rate_unit).toBe('seeds_per_plant');
  });

  it('normalizes gram-per-100-sqm style values to g_per_m2', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier: { id: 10, name: 'Bingenheimer' },
      seed_rate_unit: 'Gramm pro 100 Quadratmeter' as unknown as Culture['seed_rate_unit'],
    } as Culture);

    render(
      <MemoryRouter>
        <CommandProvider>
          <Cultures />
        </CommandProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.seed_rate_unit).toBe('g_per_m2');
  });

  it('includes supplier_data row ids so nested records update instead of duplicate create', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier_data: [
        {
          id: 77,
          supplier_id: 10,
          supplier_name: 'Bingenheimer',
          packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
        },
      ],
    } as unknown as Culture);

    render(
      <MemoryRouter>
        <CommandProvider>
          <Cultures />
        </CommandProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1] as { supplier_data_input?: Array<{ id?: number }> };
    expect(payload.supplier_data_input?.[0]?.id).toBe(77);
  });

  it('sends all supplier rows in supplier_data_input when saving', async () => {
    saveCultureMock.mockReturnValue({
      id: 1,
      name: 'Karotte',
      variety: 'Nantaise',
      supplier_data: [
        {
          id: 77,
          supplier_id: 10,
          supplier_name: 'Bingenheimer',
          supplier_product_name: 'Karotten-Saatgut',
          packaging_sizes: [{ size_value: 25, size_unit: 'g' }],
        },
        {
          id: 78,
          supplier_id: 11,
          supplier_name: 'Dreschflegel',
          supplier_product_name: 'Möhren Premium',
          packaging_sizes: [{ size_value: 50, size_unit: 'g' }],
        },
      ],
      thousand_kernel_weight_g: 3.5,
    } as unknown as Culture);

    render(
      <MemoryRouter>
        <CommandProvider>
          <Cultures />
        </CommandProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Kultur bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1] as { supplier_data_input?: Array<{ id?: number }>; thousand_kernel_weight_g?: number };
    expect(payload.supplier_data_input).toHaveLength(2);
    expect(payload.supplier_data_input?.map((row) => row.id)).toEqual([77, 78]);
    expect(payload.thousand_kernel_weight_g).toBe(3.5);
  });

  it('shows and selects newly created culture immediately after save', async () => {
    listMock
      .mockResolvedValueOnce({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [{ id: 1, name: 'Karotte', variety: 'Nantaise' }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          count: 2,
          next: null,
          previous: null,
          results: [
            { id: 1, name: 'Karotte', variety: 'Nantaise' },
            { id: 2, name: 'Neue Kultur', variety: 'Nova' },
          ],
        },
      });
    saveCultureMock.mockReturnValue({
      name: 'Neue Kultur',
      variety: 'Nova',
    } as Culture);

    render(
      <MemoryRouter>
        <CommandProvider>
          <Cultures />
        </CommandProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Kultur hinzufügen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('culture-list')).toHaveTextContent('Karotte, Neue Kultur'));
    expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');
  });
});
