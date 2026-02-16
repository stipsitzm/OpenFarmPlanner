import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFieldOperations } from '../components/hierarchy/hooks/useFieldOperations';

const { createFieldMock, deleteFieldMock } = vi.hoisted(() => ({
  createFieldMock: vi.fn(),
  deleteFieldMock: vi.fn(),
}));

vi.mock('../api/api', () => ({
  fieldAPI: {
    create: createFieldMock,
    delete: deleteFieldMock,
  },
}));

describe('useFieldOperations', () => {
  const originalPrompt = window.prompt;
  const originalConfirm = window.confirm;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.prompt = originalPrompt;
    window.confirm = originalConfirm;
  });

  it('shows an error when no location exists for a new field', async () => {
    const setError = vi.fn();
    const fetchData = vi.fn();

    const { result } = renderHook(() => useFieldOperations([], setError, fetchData));

    await result.current.addField();

    expect(setError).toHaveBeenCalledWith('Bitte erstellen Sie zuerst einen Standort');
    expect(createFieldMock).not.toHaveBeenCalled();
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('creates a field with trimmed name using the first location by default', async () => {
    window.prompt = vi.fn().mockReturnValue('  North Plot  ');

    const setError = vi.fn();
    const fetchData = vi.fn().mockResolvedValue(undefined);
    createFieldMock.mockResolvedValue({});

    const { result } = renderHook(() =>
      useFieldOperations([{ id: 12, name: 'Farm', area_sqm: 1000, notes: '' }], setError, fetchData)
    );

    await result.current.addField();

    expect(createFieldMock).toHaveBeenCalledWith({
      name: 'North Plot',
      location: 12,
      area_sqm: undefined,
      notes: '',
    });
    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('');
  });

  it('uses explicitly provided location id instead of default location', async () => {
    window.prompt = vi.fn().mockReturnValue('Custom field');

    const setError = vi.fn();
    const fetchData = vi.fn().mockResolvedValue(undefined);
    createFieldMock.mockResolvedValue({});

    const { result } = renderHook(() =>
      useFieldOperations([{ id: 1, name: 'Default', area_sqm: 1, notes: '' }], setError, fetchData)
    );

    await result.current.addField(99);

    expect(createFieldMock).toHaveBeenCalledWith(
      expect.objectContaining({ location: 99 })
    );
  });

  it('does not create a field when prompt is cancelled or blank', async () => {
    const setError = vi.fn();
    const fetchData = vi.fn();

    const { result } = renderHook(() =>
      useFieldOperations([{ id: 5, name: 'A', area_sqm: 20, notes: '' }], setError, fetchData)
    );

    window.prompt = vi.fn().mockReturnValue('   ');
    await result.current.addField();

    window.prompt = vi.fn().mockReturnValue(null);
    await result.current.addField();

    expect(createFieldMock).not.toHaveBeenCalled();
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('reports API errors when creating a field fails', async () => {
    window.prompt = vi.fn().mockReturnValue('Failing field');

    const setError = vi.fn();
    const fetchData = vi.fn();
    createFieldMock.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() =>
      useFieldOperations([{ id: 3, name: 'A', area_sqm: 20, notes: '' }], setError, fetchData)
    );

    await result.current.addField();

    expect(setError).toHaveBeenCalledWith('Fehler beim Erstellen des Schlags');
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('deletes a field only after user confirmation and reloads data', async () => {
    window.confirm = vi.fn().mockReturnValue(true);

    const setError = vi.fn();
    const fetchData = vi.fn().mockResolvedValue(undefined);
    deleteFieldMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFieldOperations([], setError, fetchData));

    await result.current.deleteField(77);

    expect(deleteFieldMock).toHaveBeenCalledWith(77);
    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('');
  });

  it('skips deletion when user cancels confirmation', async () => {
    window.confirm = vi.fn().mockReturnValue(false);

    const setError = vi.fn();
    const fetchData = vi.fn();

    const { result } = renderHook(() => useFieldOperations([], setError, fetchData));

    await result.current.deleteField(41);

    expect(deleteFieldMock).not.toHaveBeenCalled();
    expect(fetchData).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('reports API errors when deleting a field fails', async () => {
    window.confirm = vi.fn().mockReturnValue(true);

    const setError = vi.fn();
    const fetchData = vi.fn();
    deleteFieldMock.mockRejectedValue(new Error('delete failed'));

    const { result } = renderHook(() => useFieldOperations([], setError, fetchData));

    await result.current.deleteField(88);

    expect(setError).toHaveBeenCalledWith('Fehler beim Löschen des Schlags');
    expect(fetchData).not.toHaveBeenCalled();
  });
});
