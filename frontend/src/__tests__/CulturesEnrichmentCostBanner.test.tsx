import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';
import type { Culture } from '../api/types';

const { listMock, enrichMock, updateMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  enrichMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
      enrich: enrichMock,
      update: updateMock,
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: ({ onCultureSelect }: { onCultureSelect: (culture: Culture | null) => void }): ReactElement => (
    <button
      type="button"
      onClick={() => onCultureSelect({ id: 1, name: 'Buschbohne', variety: 'Faraday' } as Culture)}
    >
      select-culture
    </button>
  ),
}));

describe('Cultures enrichment cost banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({ data: {} });

    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 1, name: 'Buschbohne', variety: 'Faraday' }],
      },
    });

    enrichMock.mockResolvedValue({
      data: {
        run_id: 'enr_1_1',
        culture_id: 1,
        mode: 'complete',
        status: 'completed',
        started_at: '2026-01-01T00:00:00Z',
        finished_at: '2026-01-01T00:00:01Z',
        model: 'gpt-4.1',
        provider: 'openai_responses',
        search_provider: 'web_search',
        suggested_fields: {},
        evidence: {},
        validation: { warnings: [], errors: [] },
        usage: { inputTokens: 1234, cachedInputTokens: 100, outputTokens: 567 },
        costEstimate: {
          currency: 'USD',
          total: 0.01234,
          model: 'gpt-4.1',
          breakdown: {
            input: 0.002,
            cached_input: 0.0001,
            output: 0.004,
            web_search_calls: 0.01,
            web_search_call_count: 2,
          },
        },
      },
    });
  });

  it('renders formatted enrichment cost alert after successful run', async () => {
    render(
      <MemoryRouter>
        <CommandProvider>
          <Cultures />
        </CommandProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kultur vervollständigen (KI) (Alt+U)' }));

    await waitFor(() => {
      expect(screen.getAllByText(/KI-Kosten \(Schätzung\): \$0\.012/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Tokens: 1\.234 in \/ 567 out/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Web-Suche: 2 Calls/).length).toBeGreaterThan(0);
  });

  it('does not apply invalid yield suggestions when validation has errors', async () => {
    enrichMock.mockResolvedValueOnce({
      data: {
        run_id: 'enr_1_2',
        culture_id: 1,
        mode: 'complete',
        status: 'completed',
        started_at: '2026-01-01T00:00:00Z',
        finished_at: '2026-01-01T00:00:01Z',
        model: 'gpt-4.1',
        provider: 'openai_responses',
        search_provider: 'web_search',
        suggested_fields: {
          expected_yield: { value: 250, unit: 'kg/m²', confidence: 0.9 },
          growth_duration_days: { value: 90, unit: 'days', confidence: 0.7 },
        },
        evidence: {},
        validation: {
          warnings: [],
          errors: [{ field: 'expected_yield', code: 'yield_per_sqm_impossible', message: 'invalid yield' }],
        },
        usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 20 },
        costEstimate: {
          currency: 'USD',
          total: 0.001,
          model: 'gpt-4.1',
          breakdown: {
            input: 0.0002,
            cached_input: 0,
            output: 0.0002,
            web_search_calls: 0,
            web_search_call_count: 0,
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <CommandProvider>
          <Cultures />
        </CommandProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Kultur vervollständigen (KI) (Alt+U)' }));

    await screen.findByText(/invalid yield/);
    const applyButton = screen.getAllByRole('button').find((button) => /anwenden/i.test(button.textContent || ''));
    expect(applyButton).toBeTruthy();
    fireEvent.click(applyButton!);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledTimes(1);
    });
    const updatePayload = updateMock.mock.calls[0][1] as Record<string, unknown>;
    expect(updatePayload.growth_duration_days).toBe(90);
    expect(updatePayload.expected_yield).toBeUndefined();
  });

});
