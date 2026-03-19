import type { ShortcutKeys } from '../hooks/useKeyboardShortcuts';

export type CommandContextTag =
  | 'global'
  | 'cultures'
  | 'locations'
  | 'areas'
  | 'plans'
  | 'calendar'
  | 'seedDemand';

export type CommandGroup = 'project' | 'account' | 'navigation' | 'help';

export interface CommandSpec {
  id: string;
  label: string;
  keywords: string[];
  group: CommandGroup;
  shortcutHint?: string;
  keys?: ShortcutKeys;
  contextTags: CommandContextTag[];
  isVisible?: () => boolean;
  isEnabled?: () => boolean;
  action: () => void | Promise<void>;
}
