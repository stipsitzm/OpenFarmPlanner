import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  List,
  ListItemButton,
  TextField,
  Typography,
} from '@mui/material';
import type { CommandSpec } from './types';

interface CommandPaletteProps {
  open: boolean;
  commands: CommandSpec[];
  onClose: () => void;
}

export function filterCommands(commands: CommandSpec[], query: string): CommandSpec[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return commands;
  }

  return commands.filter((command) => {
    const haystacks = [command.title, ...command.keywords].map((value) => value.toLowerCase());
    return haystacks.some((value) => value.includes(normalized));
  });
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    setSelectedIndex(0);
  }, [open]);

  const runCommand = (index: number) => {
    const command = filteredCommands[index];
    if (!command) {
      return;
    }

    command.run();
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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Command Palette (Alt+K)"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Command Palette (Alt+K)"
          sx={{ mb: 2 }}
        />
        {filteredCommands.length === 0 ? (
          <Typography color="text.secondary">Keine passenden Befehle</Typography>
        ) : (
          <List>
            {filteredCommands.map((command, index) => (
              <ListItemButton
                key={command.id}
                selected={selectedIndex === index}
                onClick={() => runCommand(index)}
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
              >
                <Typography>{command.title}</Typography>
                <Typography variant="body2" color="text.secondary">{command.shortcutHint}</Typography>
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
