import type { CommandSpec } from './types';

export interface RootCommandFactoryOptions {
  currentPath: string;
  activeProjectId: number | null;
  isProjectAdmin: boolean;
  memberships: { project_id: number; project_name: string }[];
  onNextPage: () => void;
  onPreviousPage: () => void;
  onOpenProjectSettings: () => void;
  onOpenProjectMembers: () => void;
  onOpenCreateProject: () => void;
  onSwitchProject: (projectId: number) => void | Promise<void>;
  onOpenAccountSettings: () => void;
  onOpenVersionHistory: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  labels: {
    nextPage: string;
    previousPage: string;
    openProjectSettings: string;
    openProjectMembers: string;
    createProject: string;
    switchProjectPrefix: string;
    openAccountSettings: string;
    openVersionHistory: string;
    logout: string;
    openPalette: string;
    openShortcuts: string;
  };
}

export function getVisibleCommands(commands: CommandSpec[]): CommandSpec[] {
  return commands.filter((command) => command.isVisible?.() ?? true);
}

export function getEnabledCommands(commands: CommandSpec[]): CommandSpec[] {
  return commands.filter((command) => command.isEnabled?.() ?? true);
}

export function getRunnableCommands(commands: CommandSpec[]): CommandSpec[] {
  return getEnabledCommands(getVisibleCommands(commands));
}

export function createRootCommands(options: RootCommandFactoryOptions): CommandSpec[] {
  const switchableMemberships = options.memberships.filter((membership) => membership.project_id !== options.activeProjectId);

  const projectCommands: CommandSpec[] = [
    {
      id: 'project.settings',
      label: options.labels.openProjectSettings,
      keywords: ['projekt', 'einstellungen', 'verwaltung'],
      group: 'project',
      shortcutHint: 'Alt+Shift+P',
      keys: { alt: true, shift: true, key: 'p' },
      contextTags: ['global'],
      isVisible: () => options.activeProjectId !== null,
      action: options.onOpenProjectSettings,
    },
    {
      id: 'project.members',
      label: options.labels.openProjectMembers,
      keywords: ['projekt', 'mitglieder', 'verwaltung', 'team'],
      group: 'project',
      shortcutHint: 'Alt+Shift+M',
      keys: { alt: true, shift: true, key: 'm' },
      contextTags: ['global'],
      isVisible: () => options.activeProjectId !== null && options.isProjectAdmin,
      action: options.onOpenProjectMembers,
    },
    {
      id: 'project.create',
      label: options.labels.createProject,
      keywords: ['projekt', 'neu', 'erstellen'],
      group: 'project',
      shortcutHint: 'Alt+Shift+N',
      keys: { alt: true, shift: true, key: 'n' },
      contextTags: ['global'],
      action: options.onOpenCreateProject,
    },
    ...switchableMemberships.map<CommandSpec>((membership, index) => ({
      id: `project.switch.${membership.project_id}`,
      label: `${options.labels.switchProjectPrefix}: ${membership.project_name}`,
      keywords: ['projekt', 'wechseln', 'umschalten', membership.project_name],
      group: 'project',
      shortcutHint: index < 9 ? `Alt+${index + 1}` : undefined,
      keys: index < 9
        ? { alt: true, key: `${index + 1}` }
        : undefined,
      contextTags: ['global'],
      action: () => options.onSwitchProject(membership.project_id),
    })),
  ];

  const accountCommands: CommandSpec[] = [
    {
      id: 'account.settings',
      label: options.labels.openAccountSettings,
      keywords: ['konto', 'account', 'einstellungen'],
      group: 'account',
      shortcutHint: 'Alt+Shift+A',
      keys: { alt: true, shift: true, key: 'a' },
      contextTags: ['global'],
      action: options.onOpenAccountSettings,
    },
    {
      id: 'account.versionHistory',
      label: options.labels.openVersionHistory,
      keywords: ['versionen', 'verlauf', 'historie', 'projekt'],
      group: 'account',
      shortcutHint: 'Alt+Shift+V',
      keys: { alt: true, shift: true, key: 'v' },
      contextTags: ['global'],
      isVisible: () => options.activeProjectId !== null,
      action: options.onOpenVersionHistory,
    },
    {
      id: 'account.logout',
      label: options.labels.logout,
      keywords: ['logout', 'abmelden', 'konto'],
      group: 'account',
      shortcutHint: 'Alt+Shift+L',
      keys: { alt: true, shift: true, key: 'l' },
      contextTags: ['global'],
      action: options.onLogout,
    },
  ];

  const navigationCommands: CommandSpec[] = [
    {
      id: 'navigation.nextPage',
      label: options.labels.nextPage,
      keywords: ['seite', 'nächste', 'navigation', 'weiter'],
      group: 'navigation',
      shortcutHint: 'Ctrl+Shift+→',
      keys: { ctrl: true, shift: true, key: 'ArrowRight' },
      contextTags: ['global'],
      action: options.onNextPage,
    },
    {
      id: 'navigation.previousPage',
      label: options.labels.previousPage,
      keywords: ['seite', 'vorherige', 'navigation', 'zurück'],
      group: 'navigation',
      shortcutHint: 'Ctrl+Shift+←',
      keys: { ctrl: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['global'],
      action: options.onPreviousPage,
    },
  ];

  const helpCommands: CommandSpec[] = [
    {
      id: 'help.openPalette',
      label: options.labels.openPalette,
      keywords: ['aktionssuche', 'palette', 'befehl', 'hilfe'],
      group: 'help',
      shortcutHint: 'Alt+K',
      keys: { alt: true, key: 'k' },
      contextTags: ['global'],
      action: options.onOpenPalette,
    },
    {
      id: 'help.openShortcuts',
      label: options.labels.openShortcuts,
      keywords: ['tastenkürzel', 'shortcuts', 'hilfe'],
      group: 'help',
      shortcutHint: 'Alt+H',
      keys: { alt: true, key: 'h' },
      contextTags: ['global'],
      action: options.onOpenShortcuts,
    },
  ];

  return [...projectCommands, ...accountCommands, ...navigationCommands, ...helpCommands];
}
