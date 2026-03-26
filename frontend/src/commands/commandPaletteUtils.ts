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

export interface CommandGroupWithOffset {
  group: string;
  commands: CommandSpec[];
  startIndex: number;
}

export function addGroupOffsets(groups: Array<{ group: string; commands: CommandSpec[] }>): CommandGroupWithOffset[] {
  return groups.reduce<CommandGroupWithOffset[]>((accumulator, group) => {
    const startIndex = accumulator.length === 0
      ? 0
      : accumulator[accumulator.length - 1].startIndex + accumulator[accumulator.length - 1].commands.length;

    accumulator.push({
      ...group,
      startIndex,
    });
    return accumulator;
  }, []);
}
