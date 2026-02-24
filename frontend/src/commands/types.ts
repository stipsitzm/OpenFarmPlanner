import type { ShortcutKeys } from '../hooks/useKeyboardShortcuts';

export type CommandContextTag =
  | 'global'
  | 'cultures'
  | 'locations'
  | 'areas'
  | 'plans'
  | 'calendar'
  | 'seedDemand';

export interface CommandSpec {
  id: string;
  title: string;
  keywords: string[];
  shortcutHint: string;
  keys?: ShortcutKeys;
  contextTags: CommandContextTag[];
  isAvailable: () => boolean;
  run: () => void;
}
