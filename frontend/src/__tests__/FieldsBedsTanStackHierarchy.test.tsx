import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FieldsBedsTanStackHierarchy from '../pages/FieldsBedsTanStackHierarchy';
import { mockT } from './helpers/testI18n';

const { bedListMock, fieldListMock, locationListMock } = vi.hoisted(() => ({
  bedListMock: vi.fn(),
  fieldListMock: vi.fn(),
  locationListMock: vi.fn(),
}));

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: mockT }) }));
vi.mock('../hooks/autosave', () => ({ useNavigationBlocker: vi.fn() }));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    bedAPI: { create: vi.fn(), delete: vi.fn(), list: bedListMock, update: vi.fn() },
    fieldAPI: { create: vi.fn(), delete: vi.fn(), list: fieldListMock, update: vi.fn() },
    locationAPI: { create: vi.fn(), delete: vi.fn(), list: locationListMock, update: vi.fn() },
  };
});

const renderHierarchy = () =>
  render(
    <MemoryRouter initialEntries={['/app/fields-beds']}>
      <FieldsBedsTanStackHierarchy showTitle={false} suppressContextMenuHint />
    </MemoryRouter>,
  );

describe('FieldsBedsTanStackHierarchy spike', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 });
  });

  it('fully expands small multi-location hierarchies by default', async () => {
    locationListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Hofstelle' }, { id: 2, name: 'Aussenfeld' }] },
    });
    fieldListMock.mockResolvedValue({
      data: { results: [{ id: 10, name: 'Nord', location: 1, area_sqm: 100 }] },
    });
    bedListMock.mockResolvedValue({
      data: { results: [{ id: 100, name: 'Nordbeet', field: 10, area_sqm: 20 }] },
    });

    renderHierarchy();

    await waitFor(() => expect(screen.getByTestId('tanstack-row-location-1')).toBeInTheDocument());
    expect(screen.getByTestId('tanstack-row-field-10')).toBeInTheDocument();
    expect(screen.getByTestId('tanstack-row-100')).toBeInTheDocument();
  });

  it('keeps large hierarchies scannable by leaving bed rows collapsed initially', async () => {
    const FIELD_COUNT = 250;
    locationListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Hofstelle' }, { id: 2, name: 'Aussenfeld' }] },
    });
    fieldListMock.mockResolvedValue({
      data: {
        results: Array.from({ length: FIELD_COUNT }, (_, index) => ({
          id: index + 1,
          name: `Parzelle ${index + 1}`,
          location: 1,
          area_sqm: 100,
        })),
      },
    });
    bedListMock.mockResolvedValue({
      data: { results: [{ id: 100, name: 'Beet 1', field: 1, area_sqm: 20 }] },
    });

    renderHierarchy();

    await waitFor(() => expect(screen.getByTestId('tanstack-row-location-1')).toBeInTheDocument());
    expect(screen.getByTestId('tanstack-row-field-1')).toBeInTheDocument();
    expect(screen.queryByTestId('tanstack-row-100')).not.toBeInTheDocument();
  });

  it('filters per column while keeping ancestor rows visible for context', async () => {
    const user = userEvent.setup();
    locationListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Hofstelle' }, { id: 2, name: 'Aussenfeld' }] },
    });
    fieldListMock.mockResolvedValue({
      data: {
        results: [
          { id: 10, name: 'Nord', location: 1, area_sqm: 100 },
          { id: 20, name: 'Sued', location: 2, area_sqm: 100 },
        ],
      },
    });
    bedListMock.mockResolvedValue({
      data: {
        results: [
          { id: 100, name: 'Nordbeet', field: 10, area_sqm: 20 },
          { id: 200, name: 'Suedbeet', field: 20, area_sqm: 20 },
        ],
      },
    });

    renderHierarchy();

    await waitFor(() => expect(screen.getByTestId('tanstack-row-100')).toBeInTheDocument());
    await user.type(screen.getAllByRole('textbox')[0], 'Suedbeet');

    await waitFor(() => expect(screen.queryByTestId('tanstack-row-100')).not.toBeInTheDocument());
    expect(screen.getByTestId('tanstack-row-location-2')).toBeInTheDocument();
    expect(screen.getByTestId('tanstack-row-field-20')).toBeInTheDocument();
    expect(screen.getByTestId('tanstack-row-200')).toBeInTheDocument();
  });
});
