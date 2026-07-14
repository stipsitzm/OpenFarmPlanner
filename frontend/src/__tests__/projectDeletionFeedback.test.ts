import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showProjectDeleteUndoSnackbar } from '../projects/projectDeletionFeedback';
import { GLOBAL_SNACKBAR_EVENT } from '../utils/globalSnackbar';

const projectApiMocks = vi.hoisted(() => ({
  restore: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      restore: projectApiMocks.restore,
    },
  };
});

describe('showProjectDeleteUndoSnackbar', () => {
  beforeEach(() => {
    projectApiMocks.restore.mockReset();
  });

  it('shows an undo snackbar and restores the project from its action', async () => {
    const listener = vi.fn();
    const refreshUser = vi.fn(async () => null);
    projectApiMocks.restore.mockResolvedValue({ data: { id: 7 } });
    window.addEventListener(GLOBAL_SNACKBAR_EVENT, listener);

    try {
      showProjectDeleteUndoSnackbar({
        projectId: 7,
        deletedMessage: 'Deleted',
        undoLabel: 'Undo',
        restoreSuccessMessage: 'Restored',
        restoreErrorMessage: 'Restore failed',
        refreshUser,
      });

      const firstDetail = (listener.mock.calls[0][0] as CustomEvent).detail;
      expect(firstDetail).toMatchObject({
        message: 'Deleted',
        severity: 'success',
        actionLabel: 'Undo',
      });

      await firstDetail.onAction();
    } finally {
      window.removeEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    }

    expect(projectApiMocks.restore).toHaveBeenCalledWith(7);
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[1][0] as CustomEvent).detail).toEqual({
      message: 'Restored',
      severity: 'success',
    });
  });

  it('shows an error snackbar when restore fails', async () => {
    const listener = vi.fn();
    const refreshUser = vi.fn(async () => null);
    projectApiMocks.restore.mockRejectedValue(new Error('restore failed'));
    window.addEventListener(GLOBAL_SNACKBAR_EVENT, listener);

    try {
      showProjectDeleteUndoSnackbar({
        projectId: 7,
        deletedMessage: 'Deleted',
        undoLabel: 'Undo',
        restoreSuccessMessage: 'Restored',
        restoreErrorMessage: 'Restore failed',
        refreshUser,
      });

      await (listener.mock.calls[0][0] as CustomEvent).detail.onAction();
    } finally {
      window.removeEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    }

    expect(refreshUser).not.toHaveBeenCalled();
    expect((listener.mock.calls[1][0] as CustomEvent).detail).toEqual({
      message: 'Restore failed',
      severity: 'error',
    });
  });
});
