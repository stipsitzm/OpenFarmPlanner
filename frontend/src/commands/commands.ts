import type { CommandSpec } from './types';

export interface RootCommandFactoryOptions {
  currentPath: string;
  activeProjectId: number | null;
  isProjectAdmin: boolean;
  memberships: { project_id: number; project_name: string }[];
  navigationItems: { to: string; label: string; keywords: string[] }[];
  onNextPage: () => void;
  onPreviousPage: () => void;
  onOpenProjectSettings: () => void;
  onOpenProjectMembers: () => void;
  onOpenCreateProject: () => void;
  onSwitchProject: (projectId: number) => void | Promise<void>;
  onOpenAccountSettings: () => void;
  onOpenVersionHistory: () => void | Promise<void>;
  onLogout: () => void | Promise<void>;
  onNavigate: (path: string) => void;
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
  const projectCommands: CommandSpec[] = [
    {
      id: 'project.settings',
      label: options.labels.openProjectSettings,
      keywords: ['projekt', 'einstellungen', 'verwaltung'],
      group: 'project',
      contextTags: ['global'],
      isVisible: () => options.activeProjectId !== null,
      action: options.onOpenProjectSettings,
    },
    {
      id: 'project.members',
      label: options.labels.openProjectMembers,
      keywords: ['projekt', 'mitglieder', 'verwaltung', 'team'],
      group: 'project',
      contextTags: ['global'],
      isVisible: () => options.activeProjectId !== null && options.isProjectAdmin,
      action: options.onOpenProjectMembers,
    },
    {
      id: 'project.create',
      label: options.labels.createProject,
      keywords: ['projekt', 'neu', 'erstellen'],
      group: 'project',
      contextTags: ['global'],
      action: options.onOpenCreateProject,
    },
    ...options.memberships.map<CommandSpec>((membership) => ({
      id: `project.switch.${membership.project_id}`,
      label: `${options.labels.switchProjectPrefix}: ${membership.project_name}`,
      keywords: ['projekt', 'wechseln', 'umschalten', membership.project_name],
      group: 'project',
      contextTags: ['global'],
      isVisible: () => membership.project_id !== options.activeProjectId,
      action: () => options.onSwitchProject(membership.project_id),
    })),
  ];

  const accountCommands: CommandSpec[] = [
    {
      id: 'account.settings',
      label: options.labels.openAccountSettings,
      keywords: ['konto', 'account', 'einstellungen'],
      group: 'account',
      contextTags: ['global'],
      action: options.onOpenAccountSettings,
    },
    {
      id: 'account.versionHistory',
      label: options.labels.openVersionHistory,
      keywords: ['versionen', 'verlauf', 'historie', 'projekt'],
      group: 'account',
      contextTags: ['global'],
      isVisible: () => options.activeProjectId !== null,
      action: options.onOpenVersionHistory,
    },
    {
      id: 'account.logout',
      label: options.labels.logout,
      keywords: ['logout', 'abmelden', 'konto'],
      group: 'account',
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
      contextTags: ['global'],
      action: options.onNextPage,
    },
    {
      id: 'navigation.previousPage',
      label: options.labels.previousPage,
      keywords: ['seite', 'vorherige', 'navigation', 'zurück'],
      group: 'navigation',
      shortcutHint: 'Ctrl+Shift+←',
      contextTags: ['global'],
      action: options.onPreviousPage,
    },
    ...options.navigationItems.map<CommandSpec>((item) => ({
      id: `navigation.page.${item.to}`,
      label: item.label,
      keywords: item.keywords,
      group: 'navigation',
      contextTags: ['global'],
      isVisible: () => item.to !== options.currentPath,
      action: () => options.onNavigate(item.to),
    })),
  ];

  return [...projectCommands, ...accountCommands, ...navigationCommands];
}
