import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBedOperations } from '../components/hierarchy/hooks/useBedOperations';
import type { Bed } from '../api/api';

const { createBedMock, updateBedMock, deleteBedMock } = vi.hoisted(() => ({
  createBedMock: vi.fn(),
  updateBedMock: vi.fn(),
  deleteBedMock: vi.fn(),
}));

vi.mock('../api/api', () => ({
  bedAPI: {
    create: createBedMock,
    update: updateBedMock,
    delete: deleteBedMock,
  },
}));

function createStateHarness(initialBeds: Bed[]) {
  let beds = [...initialBeds];
  const setBeds = vi.fn((updater: Bed[] | ((prev: Bed[]) => Bed[])) => {
    beds = typeof updater === 'function' ? (updater as (prev: Bed[]) => Bed[])(beds) : updater;
  });

  return {
    getBeds: () => beds,
    setBeds,
  };
}

describe('useBedOperations', () => {
  const originalConfirm = window.confirm;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  it('adds a temporary bed at the beginning with default values', () => {
    const harness = createStateHarness([{ id: 1, name: 'Existing', field: 1, notes: '' }]);
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    const tempId = result.current.addBed(9);
    const [tempBed] = harness.getBeds();

    expect(tempId).toBeLessThan(0);
    expect(tempBed).toEqual({
      id: tempId,
      name: '',
      field: 9,
      area_sqm: undefined,
      notes: '',
    });
  });

  it('creates a new bed from temporary data and replaces local temporary row', async () => {
    const temporaryBed: Bed = { id: -123, name: '', field: 2, notes: '' };
    const harness = createStateHarness([temporaryBed, { id: 5, name: 'Stable', field: 2, notes: '' }]);
    const setError = vi.fn();

    const savedBed: Bed = { id: 44, name: 'New bed', field: 2, area_sqm: 12, notes: 'Saved' };
    createBedMock.mockResolvedValue({ data: savedBed });

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    const response = await result.current.saveBed({
      id: -123,
      field: 2,
      name: 'New bed',
      area_sqm: 12,
      notes: 'Saved',
    });

    expect(createBedMock).toHaveBeenCalledWith({
      name: 'New bed',
      field: 2,
      area_sqm: 12,
      notes: 'Saved',
    });
    expect(response).toEqual(savedBed);
    expect(harness.getBeds()).toEqual([savedBed, { id: 5, name: 'Stable', field: 2, notes: '' }]);
    expect(setError).toHaveBeenCalledWith('');
  });

  it('normalizes empty values when creating a new bed', async () => {
    const harness = createStateHarness([]);
    const setError = vi.fn();
    createBedMock.mockResolvedValue({ data: { id: 11, name: '', field: 1, notes: '' } });

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    await result.current.saveBed({ id: -10, field: 1 });

    expect(createBedMock).toHaveBeenCalledWith({
      name: '',
      field: 1,
      area_sqm: undefined,
      notes: '',
    });
  });

  it('updates existing bed data in place', async () => {
    const harness = createStateHarness([
      { id: 10, name: 'A', field: 1, area_sqm: 4, notes: '' },
      { id: 11, name: 'B', field: 1, area_sqm: 6, notes: '' },
    ]);
    const setError = vi.fn();

    const updatedBed: Bed = { id: 11, name: 'B-updated', field: 1, area_sqm: 7, notes: 'ok' };
    updateBedMock.mockResolvedValue({ data: updatedBed });

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    const response = await result.current.saveBed({ id: 11, field: 1, name: 'B-updated', area_sqm: 7, notes: 'ok' });

    expect(updateBedMock).toHaveBeenCalledWith(11, {
      name: 'B-updated',
      field: 1,
      area_sqm: 7,
      notes: 'ok',
    });
    expect(response).toEqual(updatedBed);
    expect(harness.getBeds()).toEqual([
      { id: 10, name: 'A', field: 1, area_sqm: 4, notes: '' },
      updatedBed,
    ]);
    expect(setError).toHaveBeenCalledWith('');
  });

  it('propagates save errors and sets user-facing error message', async () => {
    const harness = createStateHarness([]);
    const setError = vi.fn();
    const saveError = new Error('failed');
    createBedMock.mockRejectedValue(saveError);

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    await expect(result.current.saveBed({ id: -7, field: 4, name: 'X' })).rejects.toThrow('failed');
    expect(setError).toHaveBeenCalledWith('Fehler beim Speichern des Beets');
  });

  it('does nothing when delete confirmation is cancelled', async () => {
    window.confirm = vi.fn().mockReturnValue(false);

    const harness = createStateHarness([{ id: 3, name: 'A', field: 1, notes: '' }]);
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    await result.current.deleteBed(3);

    expect(deleteBedMock).not.toHaveBeenCalled();
    expect(harness.getBeds()).toEqual([{ id: 3, name: 'A', field: 1, notes: '' }]);
  });

  it('removes unsaved bed locally without API call', async () => {
    window.confirm = vi.fn().mockReturnValue(true);

    const harness = createStateHarness([
      { id: -1, name: 'Temp', field: 1, notes: '' },
      { id: 2, name: 'Saved', field: 1, notes: '' },
    ]);
    const setError = vi.fn();

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    await result.current.deleteBed(-1);

    expect(deleteBedMock).not.toHaveBeenCalled();
    expect(harness.getBeds()).toEqual([{ id: 2, name: 'Saved', field: 1, notes: '' }]);
  });

  it('deletes persisted bed and updates local state', async () => {
    window.confirm = vi.fn().mockReturnValue(true);

    const harness = createStateHarness([
      { id: 8, name: 'Bed 8', field: 1, notes: '' },
      { id: 9, name: 'Bed 9', field: 1, notes: '' },
    ]);
    const setError = vi.fn();
    deleteBedMock.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    await result.current.deleteBed(8);

    expect(deleteBedMock).toHaveBeenCalledWith(8);
    expect(harness.getBeds()).toEqual([{ id: 9, name: 'Bed 9', field: 1, notes: '' }]);
    expect(setError).toHaveBeenCalledWith('');
  });

  it('propagates delete errors and keeps state unchanged', async () => {
    window.confirm = vi.fn().mockReturnValue(true);

    const startingBeds: Bed[] = [{ id: 21, name: 'Locked', field: 2, notes: '' }];
    const harness = createStateHarness(startingBeds);
    const setError = vi.fn();

    const deleteError = new Error('cannot delete');
    deleteBedMock.mockRejectedValue(deleteError);

    const { result } = renderHook(() =>
      useBedOperations(harness.getBeds(), harness.setBeds, setError)
    );

    await expect(result.current.deleteBed(21)).rejects.toThrow('cannot delete');

    expect(setError).toHaveBeenCalledWith('Fehler beim Löschen des Beets');
    expect(harness.getBeds()).toEqual(startingBeds);
  });
});
