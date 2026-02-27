import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';
import type { Culture } from '../api/types';

const { listMock, updateMock, saveCultureMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  updateMock: vi.fn(),
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
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: ({ onCultureSelect }: { onCultureSelect: (culture: Culture | null) => void }): ReactElement => (
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
    fireEvent.click(screen.getByRole('button', { name: 'Kultur bearbeiten (Alt+E)' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Kultur bearbeiten (Alt+E)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'submit-edit' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.seed_rate_unit).toBe('g_per_m2');
  });
});
