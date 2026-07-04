import { useContext, useEffect } from 'react';
import type { RefObject } from 'react';
import { getFocusableElements } from './focusableElements';
import { FocusManagerContext, type FocusManagerContextValue } from './focusManagerContext';

export function useFocusManager(): FocusManagerContextValue {
  const context = useContext(FocusManagerContext);
  if (!context) {
    throw new Error('useFocusManager must be used within a FocusManagerProvider');
  }
  return context;
}

interface UseFocusRegionOptions {
  label: string;
  order: number;
  /** Trap Tab/Shift+Tab so it wraps within the region instead of leaving it.
   * Defaults to true — this is the core "Tab only moves within the active
   * region" rule. Set to false for regions MUI already traps internally
   * (e.g. an open `Dialog`), to avoid two traps fighting each other. */
  trapTab?: boolean;
}

/** Registers `containerRef`'s element as an F6-reachable focus region for
 * as long as the calling component is mounted, and (unless disabled) traps
 * Tab/Shift+Tab so they cycle within the region instead of escaping it. */
export function useFocusRegion(
  regionId: string,
  containerRef: RefObject<HTMLElement | null>,
  { label, order, trapTab = true }: UseFocusRegionOptions,
): void {
  const { registerRegion } = useFocusManager();

  useEffect(() => {
    const container = containerRef.current;
    // Regions need to be focusable as a fallback landing target (e.g. one
    // with no focusable descendants yet), and get a consistent visible
    // focus ring — see the `.ofp-focus-region:focus` rule in theme.ts.
    if (container && !container.hasAttribute('tabindex')) {
      container.tabIndex = -1;
    }
    container?.classList.add('ofp-focus-region');

    return registerRegion({ id: regionId, label, order, containerRef });
    // containerRef is a stable ref object; re-registering on every render
    // would thrash the region map for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId, label, order, registerRegion]);

  useEffect(() => {
    if (!trapTab) {
      return undefined;
    }
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      // `defaultPrevented` means a more specific handler further down the
      // tree (e.g. a DataGrid cell's own Tab navigation) already took
      // charge of this key press — defer to it instead of also acting.
      if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey || event.defaultPrevented) {
        return;
      }

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (active === container) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, trapTab]);
}
