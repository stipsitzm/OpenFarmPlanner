import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Suppliers from '../pages/Suppliers';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    supplierAPI: {
      ...actual.supplierAPI,
      list: mocks.list,
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
    expect(screen.getByRole('link', { name: 'Lieferant anlegen' })).toBeInTheDocument();
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
});
