/**
 * Reusable hook for spreadsheet-like autosave behavior.
 * 
 * Provides draft-first editing with automatic save on blur.
 * Validates before saving and blocks navigation on unsaved changes.
 * 
 * @template T The type of data being edited
 * @param options Configuration options
 * @returns Draft state and control functions
 * 
 * @remarks
 * Used across all forms and editable grids in OpenFarmPlanner.
 * Implements the autosave pattern: edit locally, validate on blur, save if valid.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Validation result from validation function
 */
export interface ValidationResult {
  /** Whether the data is valid */
  isValid: boolean;
  /** Map of field names to error messages */
  errors: Record<string, string>;
}

/**
 * Save trigger reason for tracking and debugging
 */
export type SaveReason = 'blur' | 'debounced' | 'manual' | 'beforeunload' | 'routechange';

/**
 * Options for configuring the autosave hook
 */
export interface UseAutosaveDraftOptions<T> {
  /** Initial data to populate the draft */
  initialData: T;
  /** Function to validate the draft data */
  validate: (draft: T) => ValidationResult;
  /** Async function to save the draft to the server */
  save: (draft: T, reason: SaveReason) => Promise<T>;
  /** Optional callback when save succeeds */
  onSaveSuccess?: (saved: T) => void;
  /** Optional callback when save fails */
  onSaveError?: (error: Error) => void;
  /** Optional debounce delay in ms (default: 0 = no debounce) */
  debounceMs?: number;
  /** Whether to show validation errors immediately (default: false, show only on blur) */
  showErrorsImmediately?: boolean;
}

/**
 * Return value from the autosave hook
 */
export interface UseAutosaveDraftReturn<T> {
  /** Current draft state */
  draft: T;
  /** Update a single field in the draft */
  setField: (path: string, value: unknown) => void;
  /** Update multiple fields in the draft */
  updateDraft: (partial: Partial<T>) => void;
  /** Replace entire draft with new data */
  setDraft: (data: T) => void;
  /** Current validation errors */
  errors: Record<string, string>;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether the current draft is valid */
  isValid: boolean;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Manually validate the draft */
  validate: () => ValidationResult;
  /** Save the draft if it's valid */
  saveIfValid: (reason: SaveReason) => Promise<boolean>;
  /** Reset draft to initial state */
  resetDraft: () => void;
  /** Update the saved state (e.g., after successful save) */
  commitSavedState: (serverData: T) => void;
}

/**
 * Custom hook for autosave draft management
 */
export function useAutosaveDraft<T extends Record<string, unknown>>(
  options: UseAutosaveDraftOptions<T>
): UseAutosaveDraftReturn<T> {
  const {
    initialData,
    validate: validateFn,
    save: saveFn,
    onSaveSuccess,
    onSaveError,
    showErrorsImmediately = false,
  } = options;

  // Draft state
  const [draft, setDraftState] = useState<T>(initialData);
  const [savedState, setSavedState] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(showErrorsImmediately);

  // Refs for tracking in-flight saves and debounce
  const saveAbortController = useRef<AbortController | null>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<T>(draft);

  // Keep ref in sync with draft
  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  // Update initial data when it changes (e.g., when editing a different entity)
  useEffect(() => {
    setDraftState(initialData);
    setSavedState(initialData);
    setErrors({});
    setShowErrors(showErrorsImmediately);
  }, [initialData, showErrorsImmediately]);

  /**
   * Check if draft has unsaved changes
   */
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedState);

  /**
   * Validate the current draft
   */
  const validate = useCallback((): ValidationResult => {
    return validateFn(draft);
  }, [draft, validateFn]);

  /**
   * Current validation state
   */
  const isValid = validate().isValid;

  /**
   * Set a single field value using dot notation path
   */
  const setField = useCallback((path: string, value: unknown) => {
    setDraftState((prev) => {
      const keys = path.split('.');
      const newDraft = { ...prev };
      let current: Record<string, unknown> = newDraft;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }
      
      const lastKey = keys[keys.length - 1];
      current[lastKey] = value;
      
      return newDraft;
    });

    // Clear error for this field when user starts typing
    if (errors[path]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[path];
        return newErrors;
      });
    }
  }, [errors]);

  /**
   * Update draft with partial data
   */
  const updateDraft = useCallback((partial: Partial<T>) => {
    setDraftState((prev) => ({ ...prev, ...partial }));
  }, []);

  /**
   * Set entire draft
   */
  const setDraft = useCallback((data: T) => {
    setDraftState(data);
  }, []);

  /**
   * Reset draft to saved state
   */
  const resetDraft = useCallback(() => {
    setDraftState(savedState);
    setErrors({});
    setShowErrors(false);
  }, [savedState]);

  /**
   * Commit server data as the new saved state
   */
  const commitSavedState = useCallback((serverData: T) => {
    setSavedState(serverData);
    setDraftState(serverData);
    setErrors({});
    setShowErrors(false);
  }, []);

  /**
   * Save the draft if valid
   */
  const saveIfValid = useCallback(async (reason: SaveReason): Promise<boolean> => {
    // Cancel any pending debounced save
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = null;
    }

    // Abort any in-flight save
    if (saveAbortController.current) {
      saveAbortController.current.abort();
    }

    // Get current draft from ref (in case of race conditions)
    const draftToSave = latestDraftRef.current;

    // Validate
    const validationResult = validateFn(draftToSave);
    setErrors(validationResult.errors);
    setShowErrors(true);

    if (!validationResult.isValid) {
      return false;
    }

    // Check if there are changes to save
    if (JSON.stringify(draftToSave) === JSON.stringify(savedState)) {
      return true; // Nothing to save
    }

    // Create abort controller for this save
    const abortController = new AbortController();
    saveAbortController.current = abortController;

    setIsSaving(true);

    try {
      const savedData = await saveFn(draftToSave, reason);
      
      // Check if this save was aborted
      if (abortController.signal.aborted) {
        return false;
      }

      setSavedState(savedData);
      setDraftState(savedData);
      setErrors({});
      
      if (onSaveSuccess) {
        onSaveSuccess(savedData);
      }

      return true;
    } catch (error) {
      // Check if this save was aborted
      if (abortController.signal.aborted) {
        return false;
      }

      if (onSaveError) {
        onSaveError(error as Error);
      }

      return false;
    } finally {
      // Only clear saving state if this is still the current save
      if (saveAbortController.current === abortController) {
        setIsSaving(false);
        saveAbortController.current = null;
      }
    }
  }, [validateFn, saveFn, savedState, onSaveSuccess, onSaveError]);

  /**
   * Setup beforeunload handler to warn about unsaved changes
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && isValid) {
        e.preventDefault();
        // Modern browsers ignore custom messages, but setting returnValue triggers the dialog
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, isValid]);

  return {
    draft,
    setField,
    updateDraft,
    setDraft,
    errors: showErrors ? errors : {},
    isDirty,
    isValid,
    isSaving,
    validate,
    saveIfValid,
    resetDraft,
    commitSavedState,
  };
}
