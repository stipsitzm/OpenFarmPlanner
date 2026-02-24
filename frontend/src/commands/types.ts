import type { ShortcutKeys } from '../hooks/useKeyboardShortcuts';

export interface CommandSpec {
  id: string;
  title: string;
  keywords: string[];
  shortcutHint: string;
  keys?: ShortcutKeys;
  contextTags: string[];
  isAvailable: () => boolean;
  run: () => void;
}
