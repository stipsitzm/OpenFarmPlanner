/**
 * Custom hook for keyboard navigation between main views.
 * 
 * Provides Ctrl+Shift+ArrowRight and Ctrl+Shift+ArrowLeft shortcuts to cycle through
 * the main application routes in a circular manner.
 * These shortcuts don't conflict with browser navigation or tab switching.
 * Shortcuts are disabled when focus is on input or textarea elements.
 * 
 * @returns void
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Define the ordered list of routes to cycle through
const ROUTES = [
  '/',
  '/locations',
  '/fields-beds',
  '/cultures',
  '/planting-plans',
  '/tasks',
  '/gantt-chart',
];

export function useKeyboardNavigation(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Check if Ctrl+Shift+ArrowRight/Left is pressed
      const isNavigationShortcut = 
        event.ctrlKey && 
        event.shiftKey && 
        !event.altKey &&
        (event.key === 'ArrowRight' || event.key === 'ArrowLeft');
      
      if (!isNavigationShortcut) {
        return;
      }

      // Don't trigger shortcuts when user is typing in input fields or textareas
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement && 'contentEditable' in activeElement && activeElement.contentEditable === 'true')
      ) {
        return;
      }

      // Prevent default behavior
      event.preventDefault();

      // Normalize pathname by removing trailing slash
      const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
      
      // Find current route index
      const currentIndex = ROUTES.indexOf(normalizedPath);
      
      // If current route is not in the list, default to home
      if (currentIndex === -1) {
        navigate(ROUTES[0]);
        return;
      }

      // Calculate next index based on direction
      let nextIndex: number;
      if (event.key === 'ArrowLeft') {
        // Ctrl+Shift+ArrowLeft: go to previous route
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = ROUTES.length - 1; // Wrap to last route
        }
      } else {
        // Ctrl+Shift+ArrowRight: go to next route
        nextIndex = currentIndex + 1;
        if (nextIndex >= ROUTES.length) {
          nextIndex = 0; // Wrap to first route
        }
      }

      // Navigate to the next route
      navigate(ROUTES[nextIndex]);
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, location.pathname]);
}
