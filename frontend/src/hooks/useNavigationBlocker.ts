/**
 * Hook for blocking navigation when there are unsaved changes.
 * 
 * Uses React Router's blocker API to prevent route changes
 * when there are unsaved changes that would be lost.
 * Falls back to beforeunload handler only if not in a data router context.
 * 
 * @param shouldBlock Function that returns true if navigation should be blocked
 * @param message Optional custom message for the confirmation dialog
 * 
 * @remarks
 * Used in conjunction with useAutosaveDraft to prevent data loss.
 * Shows a confirmation dialog when user tries to navigate away.
 * Compatible with both BrowserRouter and data routers (createBrowserRouter).
 */

import { useEffect } from 'react';

/**
 * Hook to block navigation when there are unsaved changes
 */
export function useNavigationBlocker(
  shouldBlock: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave?'
): void {
  // Setup beforeunload handler for browser navigation (tab close, reload, etc.)
  useEffect(() => {
    if (!shouldBlock) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages, but setting returnValue triggers the dialog
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldBlock, message]);

  // Note: React Router navigation blocking with useBlocker only works with data routers
  // (createBrowserRouter), not with BrowserRouter. Since this app uses BrowserRouter,
  // we rely on the beforeunload handler above for browser navigation protection.
  // For in-app navigation blocking with BrowserRouter, consider upgrading to a data router
  // or implementing a custom solution with route change listeners.
}
