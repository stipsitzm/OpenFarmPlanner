/**
 * Hook for blocking navigation when there are unsaved changes.
 * 
 * Uses React Router's blocker API to prevent route changes
 * when there are unsaved changes that would be lost.
 * Also handles browser navigation via beforeunload.
 * 
 * @param shouldBlock Function that returns true if navigation should be blocked
 * @param message Optional custom message for the confirmation dialog
 * 
 * @remarks
 * Used in conjunction with useAutosaveDraft to prevent data loss.
 * Shows a confirmation dialog when user tries to navigate away.
 * Works with data routers (createBrowserRouter).
 */

import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

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

  // Use React Router's blocker for in-app navigation
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    // Only block if we're actually navigating to a different location
    return shouldBlock && currentLocation.pathname !== nextLocation.pathname;
  });

  // Handle blocker state
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const proceed = window.confirm(message);
      if (proceed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker, message]);
}
