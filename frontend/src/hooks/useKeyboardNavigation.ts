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
import { useLocation, useNavigate } from 'react-router-dom';

const APP_BASE = '/app';

// Define the ordered list of routes to cycle through.
const ROUTES = [
  '/app/locations',
  '/app/fields-beds',
  '/app/cultures',
  '/app/anbauplaene',
  '/app/gantt-chart',
  '/app/seed-demand',
  '/app/suppliers',
];

export function useKeyboardNavigation(): void {
  const navigate = useNavigate();
  const location = useLocation();

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

      // Normalize pathname by removing trailing slash and mapping aliases.
      const rawPath = location.pathname.replace(/\/$/, '') || '/';
      const normalizedPath =
        rawPath === '/planting-plans' ? '/app/anbauplaene'
          : rawPath.startsWith('/app/') ? rawPath
            : `${APP_BASE}${rawPath === '/' ? '/anbauplaene' : rawPath}`;

      const currentIndex = ROUTES.indexOf(normalizedPath);

      if (currentIndex === -1) {
        navigate('/app/anbauplaene');
        return;
      }

      let nextIndex: number;
      if (event.key === 'ArrowLeft') {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = ROUTES.length - 1;
        }
      } else {
        nextIndex = currentIndex + 1;
        if (nextIndex >= ROUTES.length) {
          nextIndex = 0;
        }
      }

      navigate(ROUTES[nextIndex]);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, location.pathname]);
}
