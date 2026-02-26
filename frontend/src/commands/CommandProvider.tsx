import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Typography,
} from '@mui/material';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette } from './CommandPalette';
import type { CommandContextTag, CommandSpec } from './types';
import type { ShortcutSpec } from '../hooks/useKeyboardShortcuts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface CommandContextValue {
  registerCommands: (scope: string, commands: CommandSpec[]) => () => void;
  setContextTag: (tag: CommandContextTag, active: boolean) => void;
  openPalette: () => void;
  closePalette: () => void;
  currentContextTags: CommandContextTag[];
}

const CONTEXT_TITLES: Record<CommandContextTag, string> = {
  global: 'Global',
  cultures: 'Kulturen',
  locations: 'Standorte',
  areas: 'Anbauflächen',
  plans: 'Anbaupläne',
  calendar: 'Anbaukalender',
  seedDemand: 'Saatgutbedarf',
};

const SHORTCUT_HINT_KEY = 'ofp.shortcutHintSeen';

const CommandContext = createContext<CommandContextValue | null>(null);

export function CommandProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [commandsByScope, setCommandsByScope] = useState<Record<string, CommandSpec[]>>({});
  const [contextTagMap, setContextTagMap] = useState<Record<CommandContextTag, boolean>>({ global: true } as Record<CommandContextTag, boolean>);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const currentContextTags = useMemo(
    () => Object.entries(contextTagMap).filter(([, active]) => active).map(([tag]) => tag as CommandContextTag),
    [contextTagMap],
  );

  useEffect(() => {
    if (localStorage.getItem(SHORTCUT_HINT_KEY) !== null) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setHintOpen(true);
      localStorage.setItem(SHORTCUT_HINT_KEY, '1');
    }, 1800);

    return () => window.clearTimeout(timerId);
  }, []);

  const openPalette = useCallback(() => {
    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    previouslyFocusedElementRef.current?.focus();
  }, []);

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

  const setContextTag = useCallback((tag: CommandContextTag, active: boolean) => {
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

  const allCommands = useMemo(() => Object.values(commandsByScope).flat(), [commandsByScope]);

  const activeCommands = useMemo(() => {
    return allCommands
      .filter((command) => command.contextTags.every((tag) => currentContextTags.includes(tag)))
      .filter((command) => command.isAvailable());
  }, [allCommands, currentContextTags]);

  const helpCommands = useMemo(() => {
    return allCommands.filter((command) => command.isAvailable());
  }, [allCommands]);

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
        title: 'Command Palette',
        keys: { alt: true, key: 'k' },
        contexts: [],
        action: openPalette,
      },
      {
        id: 'shortcuts-help.open',
        title: 'Shortcuts Hilfe',
        keys: { alt: true, key: 'h' },
        contexts: [],
        action: () => setHelpOpen(true),
      },
      ...commandShortcuts,
    ];
  }, [activeCommands, openPalette]);

  useKeyboardShortcuts(shortcutSpecs, !paletteOpen, { currentContexts: currentContextTags });

  const groupedHelpCommands = useMemo(() => {
    const grouped = new Map<CommandContextTag, CommandSpec[]>();

    helpCommands.forEach((command) => {
      const tags = command.contextTags.length > 0 ? command.contextTags : (['global'] as const);
      tags.forEach((tag) => {
        const existing = grouped.get(tag) ?? [];
        grouped.set(tag, [...existing, command]);
      });
    });

    return (Object.keys(CONTEXT_TITLES) as CommandContextTag[])
      .map((tag) => ({ tag, title: CONTEXT_TITLES[tag], commands: grouped.get(tag) ?? [] }))
      .filter((group) => group.commands.length > 0);
  }, [helpCommands]);

  const contextValue = useMemo(
    () => ({ registerCommands, setContextTag, openPalette, closePalette, currentContextTags }),
    [closePalette, currentContextTags, openPalette, registerCommands, setContextTag],
  );

  return (
    <CommandContext.Provider value={contextValue}>
      {children}
      <CommandPalette open={paletteOpen} commands={activeCommands} onClose={closePalette} />
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Tastenkürzel (Alt+H)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Shortcuts sind browser-sicher und überschreiben keine üblichen Browser-Shortcuts.
          </Typography>
          {groupedHelpCommands.map((group) => (
            <div key={group.tag}>
              <Typography variant="h6" sx={{ mt: 2 }}>{group.title}</Typography>
              <List dense>
                {group.commands.map((command) => (
                  <ListItem key={`${group.tag}-${command.id}`}>
                    <ListItemText
                      primary={command.title}
                      secondary={command.shortcutHint}
                      slotProps={{
                        secondary: {
                          style: { textAlign: 'right' },
                        },
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </div>
          ))}
        </DialogContent>
      </Dialog>
      <Snackbar
        open={hintOpen}
        autoHideDuration={6000}
        onClose={() => setHintOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setHintOpen(false)}>
          💡 Tipp: Drücke Alt+K für die Command Palette.
        </Alert>
      </Snackbar>
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
