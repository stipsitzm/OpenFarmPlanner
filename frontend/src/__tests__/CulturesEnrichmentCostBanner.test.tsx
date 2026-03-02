import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';
import type { Culture } from '../api/types';

const { listMock, enrichMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  enrichMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
      enrich: enrichMock,
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
        model: 'gpt-5',
        provider: 'openai_responses',
        search_provider: 'web_search',
        suggested_fields: {},
        evidence: {},
        validation: { warnings: [], errors: [] },
        usage: { inputTokens: 1234, cachedInputTokens: 100, outputTokens: 567 },
        costEstimate: {
          currency: 'USD',
          total: 0.01234,
          model: 'gpt-5',
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
      expect(screen.getAllByText(/KI-Kosten \(Schätzung, inkl\. 20% MwSt\.\): \$0\.019/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Tokens: 1\.234 in \/ 567 out/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Web-Suche: 2 Calls/).length).toBeGreaterThan(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('triggers AI actions via keyboard shortcuts', async () => {
    render(
      <MemoryRouter>
        <CommandProvider>
          <Cultures />
        </CommandProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'select-culture' }));

    fireEvent.keyDown(window, { altKey: true, key: 'u' });
    await waitFor(() => {
      expect(enrichMock).toHaveBeenCalled();
    });
    expect(enrichMock.mock.calls.at(-1)?.[1]).toBe('complete');

    fireEvent.keyDown(window, { altKey: true, key: 'r' });
    await waitFor(() => {
      expect(enrichMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(enrichMock.mock.calls.at(-1)?.[1]).toBe('reresearch');

    fireEvent.keyDown(window, { altKey: true, key: 'a' });
    expect(await screen.findByText('Alle Kulturen vervollständigen?')).toBeInTheDocument();
  });


});
