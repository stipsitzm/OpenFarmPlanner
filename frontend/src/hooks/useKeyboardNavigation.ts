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
import { useNavigate } from 'react-router-dom';
import { MAIN_NAV_ROUTES, normalizeMainRoutePath } from '../navigation/mainNavigation';

export function useKeyboardNavigation(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isNavigationShortcut =
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey &&
        (event.key === 'ArrowRight' || event.key === 'ArrowLeft');

      if (!isNavigationShortcut) {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement && 'contentEditable' in activeElement && activeElement.contentEditable === 'true')
      ) {
        return;
      }

      event.preventDefault();

      const normalizedPath = normalizeMainRoutePath(window.location.pathname || '/');
      const currentIndex = MAIN_NAV_ROUTES.indexOf(normalizedPath);

      if (currentIndex === -1) {
        navigate('/app/dashboard');
        return;
      }

      if (event.key === 'ArrowLeft') {
        if (currentIndex === 0) {
          return;
        }
        navigate(MAIN_NAV_ROUTES[currentIndex - 1]);
        return;
      }

      if (currentIndex >= MAIN_NAV_ROUTES.length - 1) {
        return;
      }
      navigate(MAIN_NAV_ROUTES[currentIndex + 1]);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);
}
