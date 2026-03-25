import type { CommandSpec } from './types';

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
