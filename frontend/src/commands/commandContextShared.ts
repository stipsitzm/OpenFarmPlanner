import { createContext } from 'react';
import type { CommandContextTag, CommandSpec, CreateAction } from './types';

export interface CommandContextValue {
  registerCommands: (scope: string, commands: CommandSpec[]) => () => void;
  registerCreateActions: (scope: string, actions: CreateAction[]) => () => void;
  setContextTag: (tag: CommandContextTag, active: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  currentContextTags: CommandContextTag[];
  activeCreateActions: CreateAction[];
  runPrimaryCreateAction: () => void;
}

export const CommandContext = createContext<CommandContextValue | null>(null);
