import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Suppliers from '../pages/Suppliers';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    supplierAPI: {
      ...actual.supplierAPI,
      list: mocks.list,
      create: mocks.create,
    },
  };
});

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => ({ shouldShowProjectRequiredState: false, missingProjectReason: null }),
}));

describe('Suppliers page empty and table states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows only empty-state and no table headers when no suppliers exist', async () => {
    mocks.list.mockResolvedValue({ data: { results: [] } });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Noch keine Lieferanten vorhanden')).toBeInTheDocument());
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Webseite')).not.toBeInTheDocument();
    expect(screen.queryByText('Aktionen')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lieferant hinzufügen' })).toBeInTheDocument();
  });

  it('shows table headers when suppliers exist', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Reinsaat')).toBeInTheDocument());
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Webseite')).toBeInTheDocument();
    expect(screen.getByText('Aktionen')).toBeInTheDocument();
  });

  it('shows backend supplier name errors under the name field', async () => {
    mocks.list.mockResolvedValue({ data: { results: [] } });
    mocks.create.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          name: ['Ein Lieferant mit diesem Namen existiert bereits.'],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/app/suppliers?create=true']}>
        <Suppliers />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Reinsaat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Ein Lieferant mit diesem Namen existiert bereits.')).toBeInTheDocument();
    expect(screen.queryByText('Lieferant konnte nicht gespeichert werden.')).not.toBeInTheDocument();
  });
});
