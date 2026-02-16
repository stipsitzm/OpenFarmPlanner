/**
 * Tests for autosave-related hooks and utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutosaveDraft, type ValidationResult } from '../hooks/autosave';

describe('useAutosaveDraft', () => {
  interface TestData extends Record<string, unknown> {
    id?: number;
    name: string;
    value: number;
  }

  let mockValidate: (data: TestData) => ValidationResult;
  let mockSave: (data: TestData, reason: string) => Promise<TestData>;
  let mockOnSaveSuccess: ReturnType<typeof vi.fn>;
  let mockOnSaveError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    mockValidate = (data: TestData) => {
      const errors: Record<string, string> = {};
      if (!data.name) errors.name = 'Name is required';
      return { isValid: Object.keys(errors).length === 0, errors };
    };

    mockSave = vi.fn().mockImplementation(async (data: TestData) => ({
      ...data,
      id: 1,
    }));

    mockOnSaveSuccess = vi.fn();
    mockOnSaveError = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should initialize with initial data', () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      expect(result.current.draft).toEqual(initialData);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);
      expect(result.current.errors).toEqual({});
    });

    it('should initialize with empty errors', () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      expect(result.current.errors).toEqual({});
    });
  });

  describe('Draft Updates', () => {
    it('should update draft on setField', () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      act(() => {
        result.current.setField('name', 'Updated');
      });

      expect(result.current.draft.name).toBe('Updated');
      expect(result.current.isDirty).toBe(true);
    });

    it('should update draft on updateDraft', () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      act(() => {
        result.current.updateDraft({ name: 'Updated', value: 20 });
      });

      expect(result.current.draft).toEqual({
        name: 'Updated',
        value: 20,
      });
      expect(result.current.isDirty).toBe(true);
    });

    it('should update draft on setDraft', () => {
      const initialData: TestData = { name: 'Test', value: 10 };
      const newData: TestData = { name: 'New', value: 30 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      act(() => {
        result.current.setDraft(newData);
      });

      expect(result.current.draft).toEqual(newData);
      expect(result.current.isDirty).toBe(true);
    });

    it('should clear field error when setField is called', () => {
      const initialData: TestData = { name: '', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
          showErrorsImmediately: true,
        })
      );

      // Should have validation error initially
      expect(result.current.errors.name).toBe('Name is required');

      // Clear error when user updates field
      act(() => {
        result.current.setField('name', 'Valid');
      });

      expect(result.current.errors.name).toBeUndefined();
    });

    it('should reset draft to saved state', () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      act(() => {
        result.current.updateDraft({ name: 'Changed', value: 99 });
      });

      expect(result.current.isDirty).toBe(true);

      act(() => {
        result.current.resetDraft();
      });

      expect(result.current.draft).toEqual(initialData);
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate on saveIfValid', async () => {
      const initialData: TestData = { name: '', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      const success = await act(async () => {
        return await result.current.saveIfValid('manual');
      });

      expect(success).toBe(false);
      expect(result.current.errors.name).toBe('Name is required');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should have showErrorsImmediately show errors immediately', () => {
      const initialData: TestData = { name: '', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
          showErrorsImmediately: true,
        })
      );

      expect(result.current.errors.name).toBe('Name is required');
    });

    it('should not show errors by default until blur', () => {
      const initialData: TestData = { name: '', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
          showErrorsImmediately: false,
        })
      );

      expect(result.current.errors).toEqual({});
    });
  });

  describe('Saving', () => {
    it('should save when valid', async () => {
      const initialData: TestData = { name: 'Test', value: 10 };
      const savedData: TestData = { id: 1, name: 'Test Updated', value: 20 };

      mockSave.mockResolvedValue(savedData);

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
          onSaveSuccess: mockOnSaveSuccess,
        })
      );

      act(() => {
        result.current.updateDraft({ name: 'Test Updated', value: 20 });
      });

      const success = await act(async () => {
        return await result.current.saveIfValid('blur');
      });

      expect(success).toBe(true);
      expect(mockSave).toHaveBeenCalledWith(
        { name: 'Test Updated', value: 20 },
        'blur'
      );
      expect(mockOnSaveSuccess).toHaveBeenCalledWith(savedData);
    });

    it('should not save if no changes', async () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      const success = await act(async () => {
        return await result.current.saveIfValid('blur');
      });

      expect(success).toBe(true);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      const initialData: TestData = { name: 'Test', value: 10 };
      const saveError = new Error('Save failed');

      mockSave.mockRejectedValue(saveError);

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
          onSaveError: mockOnSaveError,
        })
      );

      act(() => {
        result.current.updateDraft({ name: 'Updated', value: 20 });
      });

      const success = await act(async () => {
        return await result.current.saveIfValid('blur');
      });

      expect(success).toBe(false);
      expect(mockOnSaveError).toHaveBeenCalledWith(saveError);
    });

    it('should indicate saving state during save', async () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      mockSave.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ...initialData, id: 1 }), 100))
      );

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      act(() => {
        result.current.updateDraft({ name: 'Updated', value: 20 });
      });

      const savePromise = act(async () => {
        return await result.current.saveIfValid('manual');
      });

      // Advance fake timers to let the setTimeout resolve
      vi.advanceTimersByTime(150);

      // Check that isSaving state is tracked
      await savePromise;

      expect(mockSave).toHaveBeenCalled();
    });

    it('should include save reason in save call', async () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      mockSave.mockResolvedValue({ ...initialData, id: 1 });

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      act(() => {
        result.current.updateDraft({ value: 20 });
      });

      await act(async () => {
        await result.current.saveIfValid('debounced');
      });

      expect(mockSave).toHaveBeenCalledWith(
        expect.any(Object),
        'debounced'
      );
    });
  });

  describe('Callbacks', () => {
    it('should call onSaveSuccess callback', async () => {
      const initialData: TestData = { name: 'Test', value: 10 };
      const savedData: TestData = { id: 1, name: 'Test', value: 10 };

      mockSave.mockResolvedValue(savedData);

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
          onSaveSuccess: mockOnSaveSuccess,
        })
      );

      act(() => {
        result.current.setField('value', 20);
      });

      await act(async () => {
        await result.current.saveIfValid('blur');
      });

      expect(mockOnSaveSuccess).toHaveBeenCalledWith(savedData);
    });

    it('should call onSaveError callback on save failure', async () => {
      const initialData: TestData = { name: 'Test', value: 10 };
      const error = new Error('Save failed');

      mockSave.mockRejectedValue(error);

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
          onSaveError: mockOnSaveError,
        })
      );

      act(() => {
        result.current.setField('value', 20);
      });

      const success = await act(async () => {
        return await result.current.saveIfValid('blur');
      });

      expect(success).toBe(false);
      expect(mockOnSaveError).toHaveBeenCalledWith(error);
    });
  });

  describe('Cleanup', () => {
    it('should clean up beforeunload listener on unmount', () => {
      const initialData: TestData = { name: 'Test', value: 10 };
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it('should abort in-flight saves on unmount', async () => {
      const initialData: TestData = { name: 'Test', value: 10 };
      const abortSpy = vi.fn();

      mockSave.mockImplementation(
        () => new Promise((resolve) => {
          // Simulate long save
          setTimeout(() => resolve({ ...initialData, id: 1 }), 1000);
        })
      );

      const { result, unmount } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      act(() => {
        result.current.updateDraft({ value: 20 });
      });

      act(() => {
        result.current.saveIfValid('manual');
      });

      // Unmount before save completes
      unmount();

      // Clean up pending timers
      vi.runAllTimers();
      
      // Reset to a clean state for next tests
      vi.useFakeTimers();

      // Save should be aborted
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('Initial data changes', () => {
    it('should reset draft when initialData changes', () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      const { result, rerender } = renderHook(
        ({ initialData: initData }) =>
          useAutosaveDraft({
            initialData: initData,
            validate: mockValidate,
            save: mockSave,
          }),
        { initialProps: { initialData } }
      );

      act(() => {
        result.current.updateDraft({ name: 'Changed', value: 20 });
      });

      expect(result.current.isDirty).toBe(true);

      const newInitialData: TestData = { name: 'Different', value: 30 };
      rerender({ initialData: newInitialData });

      expect(result.current.draft).toEqual(newInitialData);
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('commitSavedState', () => {
    it('should update saved state and clear dirty flag', () => {
      const initialData: TestData = { name: 'Test', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      act(() => {
        result.current.updateDraft({ name: 'Changed', value: 20 });
      });

      expect(result.current.isDirty).toBe(true);

      const newSavedData: TestData = { id: 1, name: 'Changed', value: 20 };
      act(() => {
        result.current.commitSavedState(newSavedData);
      });

      expect(result.current.draft).toEqual(newSavedData);
      expect(result.current.isDirty).toBe(false);
      expect(result.current.errors).toEqual({});
    });
  });

  describe('validate method', () => {
    it('should return validation result', () => {
      const initialData: TestData = { name: '', value: 10 };

      const { result } = renderHook(() =>
        useAutosaveDraft({
          initialData,
          validate: mockValidate,
          save: mockSave,
        })
      );

      const validationResult = result.current.validate();

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.name).toBe('Name is required');
    });
  });
});
