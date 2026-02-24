import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CommandPalette } from './CommandPalette';
import type { CommandSpec } from './types';
import type { ShortcutSpec } from '../hooks/useKeyboardShortcuts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface CommandContextValue {
  registerCommands: (scope: string, commands: CommandSpec[]) => () => void;
  setContextTag: (tag: string, active: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  currentContextTags: string[];
}

const CommandContext = createContext<CommandContextValue | null>(null);

export function CommandProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [commandsByScope, setCommandsByScope] = useState<Record<string, CommandSpec[]>>({});
  const [contextTagMap, setContextTagMap] = useState<Record<string, boolean>>({});

  const currentContextTags = useMemo(
    () => Object.entries(contextTagMap).filter(([, active]) => active).map(([tag]) => tag),
    [contextTagMap],
  );

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const registerCommands = useCallback((scope: string, commands: CommandSpec[]) => {
    setCommandsByScope((previous) => ({ ...previous, [scope]: commands }));

    return () => {
      setCommandsByScope((previous) => {
        const nextState = { ...previous };
        delete nextState[scope];
        return nextState;
      });
    };
  }, []);

  const setContextTag = useCallback((tag: string, active: boolean) => {
    setContextTagMap((previous) => {
      if (previous[tag] === active) {
        return previous;
      }

      return {
        ...previous,
        [tag]: active,
      };
    });
  }, []);

  const activeCommands = useMemo(() => {
    return Object.values(commandsByScope)
      .flat()
      .filter((command) => command.contextTags.every((tag) => currentContextTags.includes(tag)))
      .filter((command) => command.isAvailable());
  }, [commandsByScope, currentContextTags]);

  const shortcutSpecs = useMemo<ShortcutSpec[]>(() => {
    const commandShortcuts: ShortcutSpec[] = activeCommands
      .filter((command): command is CommandSpec & { keys: NonNullable<CommandSpec['keys']> } => Boolean(command.keys))
      .map((command) => ({
        id: command.id,
        title: command.title,
        keys: command.keys,
        contexts: command.contextTags,
        when: command.isAvailable,
        action: command.run,
      }));

    return [
      {
        id: 'command-palette.open',
        title: 'Command Palette (Alt+K)',
        keys: { alt: true, key: 'k' },
        contexts: [],
        action: openPalette,
      },
      ...commandShortcuts,
    ];
  }, [activeCommands, openPalette]);

  useKeyboardShortcuts(shortcutSpecs, !paletteOpen, { currentContexts: currentContextTags });

  const contextValue = useMemo(
    () => ({ registerCommands, setContextTag, openPalette, closePalette, currentContextTags }),
    [closePalette, currentContextTags, openPalette, registerCommands, setContextTag],
  );

  return (
    <CommandContext.Provider value={contextValue}>
      {children}
      <CommandPalette open={paletteOpen} commands={activeCommands} onClose={closePalette} />
    </CommandContext.Provider>
  );
}

export function useCommandContext(): CommandContextValue {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error('useCommandContext must be used within CommandProvider');
  }

  return context;
}

export function useCommandContextTag(tag: string): void {
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
