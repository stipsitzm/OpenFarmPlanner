import { describe, expect, it, vi } from 'vitest';
import { GLOBAL_SNACKBAR_EVENT, showGlobalSnackbar } from '../utils/globalSnackbar';

describe('showGlobalSnackbar', () => {
  it('dispatches the shared global snackbar event with the provided detail', () => {
    const listener = vi.fn();
    const onAction = vi.fn();
    window.addEventListener(GLOBAL_SNACKBAR_EVENT, listener);

    showGlobalSnackbar({
      message: 'Saved',
      severity: 'success',
      actionLabel: 'Undo',
      onAction,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: 'Saved',
      severity: 'success',
      actionLabel: 'Undo',
      onAction,
    });

    window.removeEventListener(GLOBAL_SNACKBAR_EVENT, listener);
  });
});
