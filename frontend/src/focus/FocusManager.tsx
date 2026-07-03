import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getFirstFocusable } from './focusableElements';
import {
  FocusManagerContext,
  type FocusManagerContextValue,
  type FocusRegionInfo,
  type RegionShortcutHelpEntry,
} from './focusManagerContext';

function focusRegionElement(region: FocusRegionInfo): void {
  const container = region.containerRef.current;
  if (!container) {
    return;
  }
  const target = getFirstFocusable(container) ?? container;
  target.focus();
}

export function FocusManagerProvider({ children }: { children: ReactNode }) {
  const regionsRef = useRef(new Map<string, FocusRegionInfo>());
  const shortcutsHelpRef = useRef(new Map<string, RegionShortcutHelpEntry[]>());
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);

  const registerRegion = useCallback((region: FocusRegionInfo) => {
    regionsRef.current.set(region.id, region);
    return () => {
      regionsRef.current.delete(region.id);
      setActiveRegionId((current) => (current === region.id ? null : current));
    };
  }, []);

  const registerRegionShortcutsHelp = useCallback((regionId: string, entries: RegionShortcutHelpEntry[]) => {
    shortcutsHelpRef.current.set(regionId, entries);
    return () => {
      shortcutsHelpRef.current.delete(regionId);
    };
  }, []);

  const getRegionShortcutsHelp = useCallback((regionId: string | null): RegionShortcutHelpEntry[] => {
    if (!regionId) {
      return [];
    }
    return shortcutsHelpRef.current.get(regionId) ?? [];
  }, []);

  const focusRegion = useCallback((id: string) => {
    const region = regionsRef.current.get(id);
    if (!region) {
      return;
    }
    focusRegionElement(region);
  }, []);

  const cycleRegion = useCallback((direction: 1 | -1) => {
    // A region can be registered while not currently mounted in the DOM
    // (e.g. the sidebar region on a narrow viewport where it's hidden) —
    // skip those rather than landing on a dead F6 stop.
    const regions = Array.from(regionsRef.current.values())
      .filter((region) => region.containerRef.current !== null)
      .sort((a, b) => a.order - b.order);
    if (regions.length === 0) {
      return;
    }
    const currentIndex = regions.findIndex((region) => region.id === activeRegionId);
    const nextIndex = currentIndex === -1
      ? (direction === 1 ? 0 : regions.length - 1)
      : (currentIndex + direction + regions.length) % regions.length;
    focusRegionElement(regions[nextIndex]);
  }, [activeRegionId]);

  const focusNextRegion = useCallback(() => cycleRegion(1), [cycleRegion]);
  const focusPreviousRegion = useCallback(() => cycleRegion(-1), [cycleRegion]);

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const matches = Array.from(regionsRef.current.values()).filter(
        (region) => region.containerRef.current?.contains(target),
      );
      if (matches.length === 0) {
        return;
      }
      // Prefer the most deeply nested matching region (e.g. a chart region
      // inside the page's main-content region).
      const mostSpecific = matches.reduce((best, candidate) => (
        best.containerRef.current?.contains(candidate.containerRef.current) ? candidate : best
      ));
      setActiveRegionId(mostSpecific.id);
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'F6' || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }
      event.preventDefault();
      cycleRegion(event.shiftKey ? -1 : 1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleRegion]);

  const contextValue = useMemo<FocusManagerContextValue>(() => ({
    registerRegion,
    registerRegionShortcutsHelp,
    activeRegionId,
    focusRegion,
    focusNextRegion,
    focusPreviousRegion,
    getRegionShortcutsHelp,
  }), [activeRegionId, focusNextRegion, focusPreviousRegion, focusRegion, getRegionShortcutsHelp, registerRegion, registerRegionShortcutsHelp]);

  return (
    <FocusManagerContext.Provider value={contextValue}>
      {children}
    </FocusManagerContext.Provider>
  );
}
