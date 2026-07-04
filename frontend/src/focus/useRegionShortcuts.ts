import { useEffect, useMemo } from 'react';
import { useKeyboardShortcuts, type ShortcutSpec } from '../hooks/useKeyboardShortcuts';
import { useFocusManager } from './useFocusManager';

export interface RegionShortcut {
  /** A single letter/digit, or a named key like 'Enter'/'Escape'. No
   * modifier — region shortcuts are single-key by design (see the keyboard
   * architecture doc): they're already scoped to "this region has focus and
   * the user isn't typing," so a bare letter can't collide with anything. */
  key: string;
  /** Shown in the shortcuts-help dialog. */
  label: string;
  action: () => void;
  when?: () => boolean;
  allowRepeat?: boolean;
}

/**
 * Registers single-key shortcuts (e.g. `N` for "new", `E` for "edit") that
 * are only live while `regionId` is the active focus region (see
 * `useFocusRegion`) and the user isn't typing in an editable field. This is
 * the "context-dependent shortcut" half of the keyboard architecture —
 * `useKeyboardShortcuts` is the same engine the command palette uses, so
 * there is exactly one place shortcut matching happens.
 */
export function useRegionShortcuts(regionId: string, shortcuts: RegionShortcut[]): void {
  const { activeRegionId, registerRegionShortcutsHelp } = useFocusManager();
  const isActive = activeRegionId === regionId;

  const specs = useMemo<ShortcutSpec[]>(() => shortcuts.map((shortcut) => ({
    id: `region.${regionId}.${shortcut.key}`,
    title: shortcut.label,
    keys: { key: shortcut.key },
    contexts: [],
    allowRepeat: shortcut.allowRepeat,
    when: shortcut.when,
    action: shortcut.action,
  })), [regionId, shortcuts]);

  useKeyboardShortcuts(specs, isActive, { currentContexts: [] });

  useEffect(() => (
    registerRegionShortcutsHelp(regionId, shortcuts.map((shortcut) => ({
      key: shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key,
      label: shortcut.label,
    })))
  ), [regionId, shortcuts, registerRegionShortcutsHelp]);
}
