import { createContext } from 'react';
import type { CommandContextTag, CommandSpec } from './types';

export interface CommandContextValue {
  registerCommands: (scope: string, commands: CommandSpec[]) => () => void;
  setContextTag: (tag: CommandContextTag, active: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  currentContextTags: CommandContextTag[];
}

export const CommandContext = createContext<CommandContextValue | null>(null);
