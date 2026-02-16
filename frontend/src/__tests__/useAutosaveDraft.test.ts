/**
 * Tests for useAutosaveDraft hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutosaveDraft } from '../hooks/useAutosaveDraft';
import type { ValidationResult } from '../hooks/useAutosaveDraft';

interface TestData extends Record<string, unknown> {
  id?: number;
  name: string;
  value: number;
}

describe('useAutosaveDraft', () => {
  it('should initialize with initial data', () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const save = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save })
    );

    expect(result.current.draft).toEqual(initialData);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isValid).toBe(true);
  });

  it('should update draft on setField', () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const save = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save })
    );

    act(() => {
      result.current.setField('name', 'Updated');
    });

    expect(result.current.draft.name).toBe('Updated');
    expect(result.current.isDirty).toBe(true);
  });

  it('should update draft on updateDraft', () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const save = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save })
    );

    act(() => {
      result.current.updateDraft({ name: 'Updated', value: 20 });
    });

    expect(result.current.draft).toEqual({ name: 'Updated', value: 20 });
    expect(result.current.isDirty).toBe(true);
  });

  it('should validate on saveIfValid', async () => {
    const initialData: TestData = { name: '', value: 10 };
    const validate = (draft: TestData): ValidationResult => {
      const errors: Record<string, string> = {};
      if (!draft.name) errors.name = 'Name is required';
      return { isValid: Object.keys(errors).length === 0, errors };
    };
    const save = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save })
    );

    act(() => {
      result.current.setField('name', '');
    });

    const success = await act(async () => {
      return await result.current.saveIfValid('manual');
    });

    expect(success).toBe(false);
    expect(result.current.errors.name).toBe('Name is required');
    expect(save).not.toHaveBeenCalled();
  });

  it('should save when valid', async () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const savedData: TestData = { id: 1, name: 'Test Updated', value: 20 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const save = vi.fn().mockResolvedValue(savedData);

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save })
    );

    act(() => {
      result.current.updateDraft({ name: 'Test Updated', value: 20 });
    });

    const success = await act(async () => {
      return await result.current.saveIfValid('blur');
    });

    expect(success).toBe(true);
    expect(save).toHaveBeenCalledWith(
      { name: 'Test Updated', value: 20 },
      'blur'
    );
    
    await waitFor(() => {
      expect(result.current.draft).toEqual(savedData);
      expect(result.current.isDirty).toBe(false);
    });
  });

  it('should not save if no changes', async () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const save = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save })
    );

    const success = await act(async () => {
      return await result.current.saveIfValid('blur');
    });

    expect(success).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('should call onSaveSuccess callback', async () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const savedData: TestData = { id: 1, name: 'Test', value: 10 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const save = vi.fn().mockResolvedValue(savedData);
    const onSaveSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save, onSaveSuccess })
    );

    act(() => {
      result.current.setField('value', 20);
    });

    await act(async () => {
      await result.current.saveIfValid('blur');
    });

    await waitFor(() => {
      expect(onSaveSuccess).toHaveBeenCalled();
    });
  });

  it('should call onSaveError callback on save failure', async () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const error = new Error('Save failed');
    const save = vi.fn().mockRejectedValue(error);
    const onSaveError = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save, onSaveError })
    );

    act(() => {
      result.current.setField('value', 20);
    });

    const success = await act(async () => {
      return await result.current.saveIfValid('blur');
    });

    expect(success).toBe(false);
    await waitFor(() => {
      expect(onSaveError).toHaveBeenCalledWith(error);
    });
  });

  it('should reset draft to saved state', () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const save = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save })
    );

    act(() => {
      result.current.updateDraft({ name: 'Changed', value: 99 });
    });

    expect(result.current.draft.name).toBe('Changed');
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.resetDraft();
    });

    expect(result.current.draft).toEqual(initialData);
    expect(result.current.isDirty).toBe(false);
  });

  it('should update saved state with commitSavedState', () => {
    const initialData: TestData = { name: 'Test', value: 10 };
    const newData: TestData = { id: 1, name: 'New', value: 20 };
    const validate = (): ValidationResult => ({ isValid: true, errors: {} });
    const save = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save })
    );

    act(() => {
      result.current.commitSavedState(newData);
    });

    expect(result.current.draft).toEqual(newData);
    expect(result.current.isDirty).toBe(false);
  });

  it('should clear error when field is modified', async () => {
    const initialData: TestData = { name: '', value: 10 };
    const validate = (draft: TestData): ValidationResult => {
      const errors: Record<string, string> = {};
      if (!draft.name) errors.name = 'Name is required';
      return { isValid: Object.keys(errors).length === 0, errors };
    };
    const save = vi.fn();

    const { result } = renderHook(() =>
      useAutosaveDraft({ initialData, validate, save, showErrorsImmediately: true })
    );

    // Trigger validation by attempting to save
    await act(async () => {
      await result.current.saveIfValid('manual');
    });

    expect(result.current.errors.name).toBeDefined();

    // Update field should clear the error
    act(() => {
      result.current.setField('name', 'Test');
    });

    expect(result.current.errors.name).toBeUndefined();
  });
});
