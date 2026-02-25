import { useCallback, useMemo, useState } from 'react';

export interface EditCommand {
  entityType: string;
  entityId: number | string;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

interface UseUndoRedoOptions {
  canHandleShortcut?: () => boolean;
  applyCommand: (command: EditCommand, direction: 'undo' | 'redo') => void;
}

export function useUndoRedo({ applyCommand }: UseUndoRedoOptions) {
  const [undoStack, setUndoStack] = useState<EditCommand[]>([]);
  const [redoStack, setRedoStack] = useState<EditCommand[]>([]);

  const pushCommand = useCallback((command: EditCommand) => {
    if (Object.is(command.oldValue, command.newValue)) return;
    setUndoStack((prev) => [...prev, command]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    let applied = false;
    setUndoStack((prev) => {
      const cmd = prev[prev.length - 1];
      if (!cmd) return prev;
      applyCommand(cmd, 'undo');
      setRedoStack((redoPrev) => [...redoPrev, cmd]);
      applied = true;
      return prev.slice(0, -1);
    });
    return applied;
  }, [applyCommand]);

  const redo = useCallback(() => {
    let applied = false;
    setRedoStack((prev) => {
      const cmd = prev[prev.length - 1];
      if (!cmd) return prev;
      applyCommand(cmd, 'redo');
      setUndoStack((undoPrev) => [...undoPrev, cmd]);
      applied = true;
      return prev.slice(0, -1);
    });
    return applied;
  }, [applyCommand]);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return useMemo(() => ({
    pushCommand,
    undo,
    redo,
    canUndo,
    canRedo,
    undoStack,
    redoStack,
  }), [canRedo, canUndo, pushCommand, redo, redoStack, undo, undoStack]);
}
