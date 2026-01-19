/**
 * Hook for blocking navigation when there are unsaved changes.
 * 
 * Uses React Router's blocker API to prevent route changes
 * when there are unsaved changes that would be lost.
 * 
 * @param shouldBlock Function that returns true if navigation should be blocked
 * @param message Optional custom message for the confirmation dialog
 * 
 * @remarks
 * Used in conjunction with useAutosaveDraft to prevent data loss.
 * Shows a confirmation dialog when user tries to navigate away.
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
  // Use React Router's blocker
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
