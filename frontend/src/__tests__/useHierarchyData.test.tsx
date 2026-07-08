import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { locationListMock, fieldListMock, bedListMock } = vi.hoisted(() => ({
  locationListMock: vi.fn(),
  fieldListMock: vi.fn(),
  bedListMock: vi.fn(),
}));

vi.mock('../api/api', () => ({
  // listAll mirrors whatever list() is mocked to resolve, unwrapped —
  // useHierarchyData uses listAll (not list) to fetch every page.
  locationAPI: { list: locationListMock, listAll: async () => (await locationListMock()).data },
  fieldAPI: { list: fieldListMock, listAll: async () => (await fieldListMock()).data },
  bedAPI: { list: bedListMock, listAll: async () => (await bedListMock()).data },
}));

import { useHierarchyData } from '../components/hierarchy/hooks/useHierarchyData';
vi.mock('../i18n', () => {
  const translate = (key: string) => (key === 'errors.load' ? 'Fehler beim Laden der Daten' : key);
  return { useTranslation: () => ({ t: translate }) };
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

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

    locationListMock.mockRejectedValueOnce(new Error('boom'));
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

  it('keeps temporary field rows when persisted data is refreshed', async () => {
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Nord' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 2, name: 'Feld', location: 1 }] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });

    const { result } = renderHook(() => useHierarchyData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.fields).toEqual([{ id: 2, name: 'Feld', location: 1 }]);
    });

    act(() => {
      result.current.setFields((currentFields) => [
        { id: -1, name: '', location: 1 },
        ...currentFields,
      ]);
    });

    locationListMock.mockResolvedValueOnce({ data: { results: [{ id: 1, name: 'Nord' }] } });
    fieldListMock.mockResolvedValueOnce({ data: { results: [{ id: 2, name: 'Feld', location: 1 }] } });
    bedListMock.mockResolvedValueOnce({ data: { results: [] } });

    await result.current.fetchData();

    await waitFor(() => {
      expect(result.current.fields).toEqual([
        { id: -1, name: '', location: 1 },
        { id: 2, name: 'Feld', location: 1 },
      ]);
    });
  });

  it('ignores stale fetch responses after a newer background refresh starts', async () => {
    const firstLocations = createDeferred<{ data: { results: Array<{ id: number; name: string }> } }>();
    const firstFields = createDeferred<{ data: { results: Array<{ id: number; name: string; location: number }> } }>();
    const firstBeds = createDeferred<{ data: { results: never[] } }>();

    locationListMock.mockReturnValueOnce(firstLocations.promise);
    fieldListMock.mockReturnValueOnce(firstFields.promise);
    bedListMock.mockReturnValueOnce(firstBeds.promise);

    const { result } = renderHook(() => useHierarchyData());

    const secondLocations = createDeferred<{ data: { results: Array<{ id: number; name: string }> } }>();
    const secondFields = createDeferred<{ data: { results: Array<{ id: number; name: string; location: number }> } }>();
    const secondBeds = createDeferred<{ data: { results: never[] } }>();
    locationListMock.mockReturnValueOnce(secondLocations.promise);
    fieldListMock.mockReturnValueOnce(secondFields.promise);
    bedListMock.mockReturnValueOnce(secondBeds.promise);

    let refreshPromise!: Promise<void>;
    act(() => {
      refreshPromise = result.current.fetchData({ showLoading: false });
    });

    await act(async () => {
      secondLocations.resolve({ data: { results: [{ id: 1, name: 'Nord' }] } });
      secondFields.resolve({ data: { results: [{ id: 5, name: 'Neue Parzelle', location: 1 }] } });
      secondBeds.resolve({ data: { results: [] } });
      await refreshPromise;
    });

    expect(result.current.fields).toEqual([{ id: 5, name: 'Neue Parzelle', location: 1 }]);

    await act(async () => {
      firstLocations.resolve({ data: { results: [{ id: 1, name: 'Nord' }] } });
      firstFields.resolve({ data: { results: [] } });
      firstBeds.resolve({ data: { results: [] } });
      await Promise.resolve();
    });

    expect(result.current.fields).toEqual([{ id: 5, name: 'Neue Parzelle', location: 1 }]);
  });
});
