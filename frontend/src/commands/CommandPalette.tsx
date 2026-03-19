import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  List,
  ListSubheader,
  ListItemButton,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import { useTranslation } from '../i18n';
import type { CommandSpec } from './types';

interface CommandPaletteProps {
  open: boolean;
  commands: CommandSpec[];
  onClose: () => void;
}

interface GroupedCommands {
  group: string;
  commands: CommandSpec[];
}

export function filterCommands(commands: CommandSpec[], query: string): CommandSpec[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return commands;
  }

  return commands.filter((command) => {
    const haystacks = [command.label, command.group, ...command.keywords].map((value) => value.toLowerCase());
    return haystacks.some((value) => value.includes(normalized));
  });
}

function groupCommands(commands: CommandSpec[]): GroupedCommands[] {
  const grouped = new Map<string, CommandSpec[]>();
  commands.forEach((command) => {
    const existing = grouped.get(command.group) ?? [];
    grouped.set(command.group, [...existing, command]);
  });

  return Array.from(grouped.entries()).map(([group, groupCommands]) => ({ group, commands: groupCommands }));
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps): React.ReactElement {
  const { t } = useTranslation('navigation');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => filterCommands(commands, query), [commands, query]);
  const groupedCommands = useMemo(() => groupCommands(filteredCommands), [filteredCommands]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex(0);
  }, [open]);

  useEffect(() => {
    if (selectedIndex > Math.max(filteredCommands.length - 1, 0)) {
      setSelectedIndex(0);
    }
  }, [filteredCommands.length, selectedIndex]);

  const runCommand = (index: number) => {
    const command = filteredCommands[index];
    if (!command) {
      return;
    }

    void command.action();
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, Math.max(filteredCommands.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      runCommand(selectedIndex);
    }
  };

  let flatIndex = -1;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label={t('commandPalette.label')}
          placeholder={t('commandPalette.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={t('commandPalette.label')}
          sx={{ mb: 2 }}
        />
        {filteredCommands.length === 0 ? (
          <Box sx={{ py: 2 }}>
            <Typography color="text.secondary">{t('commandPalette.emptyTitle')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('commandPalette.emptyDescription')}
            </Typography>
          </Box>
        ) : (
          <List>
            {groupedCommands.map((group) => (
              <li key={group.group}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader disableSticky sx={{ px: 0, bgcolor: 'transparent', lineHeight: 2.5 }}>
                    {t(`commandGroups.${group.group}`)}
                  </ListSubheader>
                  {group.commands.map((command) => {
                    flatIndex += 1;
                    return (
                      <ListItemButton
                        key={command.id}
                        selected={selectedIndex === flatIndex}
                        onClick={() => runCommand(flatIndex)}
                        sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, borderRadius: 1 }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap>{command.label}</Typography>
                        </Box>
                        {command.shortcutHint ? (
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {command.shortcutHint}
                          </Typography>
                        ) : null}
                      </ListItemButton>
                    );
                  })}
                </ul>
              </li>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
