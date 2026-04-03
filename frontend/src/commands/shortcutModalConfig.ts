export type ShortcutModalAction = {
  id: string;
  label: string;
  shortcut: string;
  featured?: boolean;
};

export type ShortcutModalGroup = {
  id: string;
  title: string;
  actions: ShortcutModalAction[];
};

export function createShortcutModalGroups(t: (key: string) => string): ShortcutModalGroup[] {
  return [
    {
      id: 'project',
      title: t('commandPalette.shortcuts.groups.project'),
      actions: [
        {
          id: 'project.members',
          label: t('commandPalette.commands.openProjectMembers'),
          shortcut: 'Alt+Shift+M',
        },
        {
          id: 'project.create',
          label: t('commandPalette.commands.createProject'),
          shortcut: '–',
        },
        {
          id: 'project.switch',
          label: t('commandPalette.commands.switchProjectPrefix'),
          shortcut: 'Alt+1…9',
        },
      ],
    },
    {
      id: 'account',
      title: t('commandPalette.shortcuts.groups.account'),
      actions: [
        {
          id: 'account.settings',
          label: t('commandPalette.commands.openAccountSettings'),
          shortcut: 'Alt+Shift+A',
        },
        {
          id: 'account.versionHistory',
          label: t('commandPalette.commands.openVersionHistory'),
          shortcut: 'Alt+Shift+V',
        },
        {
          id: 'account.logout',
          label: t('commandPalette.commands.logout'),
          shortcut: 'Alt+Shift+L',
        },
      ],
    },
    {
      id: 'navigation',
      title: t('commandPalette.shortcuts.groups.navigation'),
      actions: [
        {
          id: 'navigation.nextPage',
          label: t('commandPalette.commands.nextPage'),
          shortcut: 'Ctrl+Shift+→',
        },
        {
          id: 'navigation.previousPage',
          label: t('commandPalette.commands.previousPage'),
          shortcut: 'Ctrl+Shift+←',
        },
      ],
    },
    {
      id: 'culture',
      title: t('commandPalette.shortcuts.groups.culture'),
      actions: [
        {
          id: 'culture.create',
          label: t('commandPalette.shortcuts.actions.createCulture'),
          shortcut: 'Alt+Shift+N',
          featured: true,
        },
        {
          id: 'culture.edit',
          label: t('commandPalette.shortcuts.actions.editCulture'),
          shortcut: 'Alt+E',
          featured: true,
        },
        {
          id: 'culture.delete',
          label: t('commandPalette.shortcuts.actions.deleteCulture'),
          shortcut: 'Alt+Shift+D',
        },
        {
          id: 'culture.createPlan',
          label: t('commandPalette.shortcuts.actions.createPlantingPlan'),
          shortcut: 'Alt+P',
        },
        {
          id: 'culture.previous',
          label: t('commandPalette.shortcuts.actions.previousCulture'),
          shortcut: 'Alt+Shift+←',
        },
        {
          id: 'culture.next',
          label: t('commandPalette.shortcuts.actions.nextCulture'),
          shortcut: 'Alt+Shift+→',
        },
      ],
    },
    {
      id: 'data',
      title: t('commandPalette.shortcuts.groups.data'),
      actions: [
        {
          id: 'culture.exportCurrent',
          label: t('commandPalette.shortcuts.actions.exportJson'),
          shortcut: 'Alt+J',
        },
        {
          id: 'culture.exportAll',
          label: t('commandPalette.shortcuts.actions.exportAllCultures'),
          shortcut: 'Alt+Shift+J',
        },
        {
          id: 'culture.import',
          label: t('commandPalette.shortcuts.actions.importJson'),
          shortcut: 'Alt+I',
        },
      ],
    },
    {
      id: 'help',
      title: t('commandPalette.shortcuts.groups.help'),
      actions: [
        {
          id: 'help.openPalette',
          label: t('commandPalette.commands.openPalette'),
          shortcut: 'Alt+K',
        },
        {
          id: 'help.openShortcuts',
          label: t('commandPalette.commands.openShortcuts'),
          shortcut: 'Alt+H',
        },
      ],
    },
  ];
}
