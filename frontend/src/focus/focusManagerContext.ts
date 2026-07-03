import { createContext } from 'react';
import type { RefObject } from 'react';

/** A named, keyboard-reachable area of the UI — e.g. the sidebar, the
 * topbar, a page's main content, or a chart/table/calendar inside it.
 * Regions are the unit `F6`/`Shift+F6` cycle between; `Tab`/`Shift+Tab`
 * only ever move *within* whichever region currently has focus. */
export interface FocusRegionInfo {
  id: string;
  /** Shown in the shortcuts-help dialog and used for debugging. */
  label: string;
  /** Lower numbers are visited first when cycling with F6. */
  order: number;
  containerRef: RefObject<HTMLElement | null>;
}

export interface RegionShortcutHelpEntry {
  key: string;
  label: string;
}

export interface FocusManagerContextValue {
  registerRegion: (region: FocusRegionInfo) => () => void;
  registerRegionShortcutsHelp: (regionId: string, entries: RegionShortcutHelpEntry[]) => () => void;
  activeRegionId: string | null;
  focusRegion: (id: string) => void;
  focusNextRegion: () => void;
  focusPreviousRegion: () => void;
  getRegionShortcutsHelp: (regionId: string | null) => RegionShortcutHelpEntry[];
}

export const FocusManagerContext = createContext<FocusManagerContextValue | null>(null);
