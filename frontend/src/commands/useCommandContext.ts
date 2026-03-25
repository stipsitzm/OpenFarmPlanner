import { useContext, useEffect } from 'react';
import { CommandContext, type CommandContextValue } from './commandContextShared';
import type { CommandContextTag, CommandSpec } from './types';

export function useCommandContext(): CommandContextValue {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error('useCommandContext must be used within CommandProvider');
  }

  return context;
}

export function useCommandContextTag(tag: CommandContextTag): void {
  const { setContextTag } = useCommandContext();

  useEffect(() => {
    setContextTag(tag, true);
    return () => setContextTag(tag, false);
  }, [setContextTag, tag]);
}

export function useRegisterCommands(scope: string, commands: CommandSpec[]): void {
  const { registerCommands } = useCommandContext();

  useEffect(() => {
    return registerCommands(scope, commands);
  }, [commands, registerCommands, scope]);
}
