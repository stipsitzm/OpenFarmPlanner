import { projectAPI } from '../api/api';
import { showGlobalSnackbar } from '../utils/globalSnackbar';

interface ShowProjectDeleteUndoSnackbarOptions {
  projectId: number;
  deletedMessage: string;
  undoLabel: string;
  restoreSuccessMessage: string;
  restoreErrorMessage: string;
  refreshUser: () => Promise<unknown>;
}

export function showProjectDeleteUndoSnackbar({
  projectId,
  deletedMessage,
  undoLabel,
  restoreSuccessMessage,
  restoreErrorMessage,
  refreshUser,
}: ShowProjectDeleteUndoSnackbarOptions): void {
  showGlobalSnackbar({
    message: deletedMessage,
    severity: 'success',
    actionLabel: undoLabel,
    onAction: async (): Promise<void> => {
      try {
        await projectAPI.restore(projectId);
        await refreshUser();
        showGlobalSnackbar({
          message: restoreSuccessMessage,
          severity: 'success',
        });
      } catch {
        showGlobalSnackbar({
          message: restoreErrorMessage,
          severity: 'error',
        });
      }
    },
  });
}
