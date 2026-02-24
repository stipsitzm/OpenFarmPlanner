/**
 * Custom hook for managing notes editor state and handlers.
 * 
 * Provides reusable notes editing functionality that can be used
 * in any component that needs to edit markdown notes in a drawer.
 */

import { useCallback, useMemo, useState } from 'react';
import type { GridRowId } from '@mui/x-data-grid';

/**
 * Options for the notes editor save callback
 */
export interface NotesEditorSaveOptions<T> {
  /** The row being edited */
  row: T;
  /** The field name being edited */
  field: string;
  /** The new notes value */
  value: string;
}

/**
 * Configuration for useNotesEditor hook
 */
export interface UseNotesEditorConfig<T> {
  /** Array of rows being displayed */
  rows: readonly T[];
  /** Callback to save notes - should update the row and return success/failure */
  onSave: (options: NotesEditorSaveOptions<T>) => Promise<void>;
  /** Callback to set error message */
  onError: (error: string) => void;
}

/**
 * Return type for useNotesEditor hook
 */
export interface UseNotesEditorReturn<T = unknown> {
  /** Whether the notes drawer is open */
  isOpen: boolean;
  /** The current row ID being edited */
  rowId: GridRowId | null;
  /** The current row object being edited */
  currentRow: T | null;
  /** The field name being edited */
  field: string | null;
  /** The draft value of the notes */
  draft: string;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Handler to open the notes editor */
  handleOpen: (rowId: GridRowId, field: string) => void;
  /** Handler to save the notes */
  handleSave: () => Promise<void>;
  /** Handler to close the notes editor */
  handleClose: () => void;
  /** Handler to update the draft value */
  setDraft: (value: string) => void;
}

/**
 * Custom hook for managing notes editor state and operations.
 * Provides a reusable way to edit notes in a drawer across different components.
 * 
 * @param config Configuration object with rows, save callback, and error handler
 * @returns State and handlers for notes editor
 */
export function useNotesEditor<T extends { id: GridRowId; [key: string]: unknown }>(
  config: UseNotesEditorConfig<T>
): UseNotesEditorReturn<T> {
  const { rows, onSave, onError } = config;
  
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [rowId, setRowId] = useState<GridRowId | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const currentRow = useMemo(() => rows.find(r => r.id === rowId) ?? null, [rows, rowId]);

  /**
   * Open the notes editor for a specific row and field
   */
  const handleOpen = useCallback((targetRowId: GridRowId, targetField: string): void => {
    const row = rows.find(r => r.id === targetRowId);
    if (!row) return;
    
    const currentValue = (row[targetField] as string) || '';
    setRowId(targetRowId);
    setField(targetField);
    setDraft(currentValue);
    setIsOpen(true);
  }, [rows]);

  /**
   * Save the notes and close the drawer
   */
  const handleSave = useCallback(async (): Promise<void> => {
    if (rowId === null || field === null) return;
    
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    
    setIsSaving(true);
    
    try {
      await onSave({ row, field, value: draft });
      
      // Success - close drawer
      setIsOpen(false);
      setRowId(null);
      setField(null);
      setDraft('');
      setIsSaving(false);
    } catch (err) {
      // Error - keep drawer open and show error
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Speichern der Notizen';
      onError(errorMessage);
      console.error('Error saving notes:', err);
      setIsSaving(false);
    }
  }, [draft, field, onError, onSave, rowId, rows]);

  /**
   * Close the notes editor without saving
   */
  const handleClose = useCallback((): void => {
    setIsOpen(false);
    setRowId(null);
    setField(null);
    setDraft('');
    setIsSaving(false);
  }, []);

  return useMemo(() => ({
    isOpen,
    rowId,
    currentRow,
    field,
    draft,
    isSaving,
    handleOpen,
    handleSave,
    handleClose,
    setDraft,
  }), [currentRow, draft, field, handleClose, handleOpen, handleSave, isOpen, isSaving, rowId]);
}
