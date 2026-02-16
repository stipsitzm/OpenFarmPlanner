import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { locationListMock, fieldListMock, bedListMock } = vi.hoisted(() => ({
  locationListMock: vi.fn(),
  fieldListMock: vi.fn(),
  bedListMock: vi.fn(),
}));

vi.mock('../api/api', () => ({
  locationAPI: { list: locationListMock },
  fieldAPI: { list: fieldListMock },
  bedAPI: { list: bedListMock },
}));

import { useHierarchyData } from '../components/hierarchy/hooks/useHierarchyData';

describe('useHierarchyData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and filters data on mount', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Nord' }, { name: 'x' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 2, name: 'Feld', location: 1 }, { name: 'x' }] } });
    bedListMock.mockResolvedValue({ data: { results: [{ id: 3, name: 'Beet', field: 2 }, { name: 'x' }] } });

    const { result } = renderHook(() => useHierarchyData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('');
      expect(result.current.locations).toEqual([{ id: 1, name: 'Nord' }]);
      expect(result.current.fields).toEqual([{ id: 2, name: 'Feld', location: 1 }]);
      expect(result.current.beds).toEqual([{ id: 3, name: 'Beet', field: 2 }]);
    });
  });

  it('sets error on failed fetch and supports manual fetchData', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    locationListMock.mockRejectedValue(new Error('boom'));
    fieldListMock.mockResolvedValue({ data: { results: [] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });

    const { result } = renderHook(() => useHierarchyData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Fehler beim Laden der Daten');
    });

    locationListMock.mockResolvedValueOnce({ data: { results: [{ id: 1, name: 'N' }] } });
    fieldListMock.mockResolvedValueOnce({ data: { results: [{ id: 2, name: 'F', location: 1 }] } });
    bedListMock.mockResolvedValueOnce({ data: { results: [{ id: 3, name: 'B', field: 2 }] } });

    await result.current.fetchData();

    await waitFor(() => {
      expect(result.current.error).toBe('');
      expect(result.current.locations).toEqual([{ id: 1, name: 'N' }]);
    });
  });
});
