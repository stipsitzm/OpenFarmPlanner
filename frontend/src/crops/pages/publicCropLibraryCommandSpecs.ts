import type { PublicCulture } from '../../api/types';
import type { CommandSpec } from '../../commands/types';

export type PublicCropLibraryCommandLabels = {
  focusSearch: string;
  edit: string;
  importToProject: string;
  showDetails: string;
  showVersions: string;
  showDiscussion: string;
  previous: string;
  next: string;
};

export type CreatePublicCropLibraryCommandSpecsOptions = {
  cultures: PublicCulture[];
  focusSearch: () => void;
  goToRelativeCulture: (direction: 'next' | 'previous') => void;
  importSelectedCulture: () => void | Promise<void>;
  openEditDialog: () => void;
  selectTab: (tabIndex: number) => void;
  selectedCulture: PublicCulture | null;
  selectedCultureId: number | null;
  labels: PublicCropLibraryCommandLabels;
};

export function createPublicCropLibraryCommandSpecs({
  cultures,
  focusSearch,
  goToRelativeCulture,
  importSelectedCulture,
  openEditDialog,
  selectTab,
  selectedCulture,
  selectedCultureId,
  labels,
}: CreatePublicCropLibraryCommandSpecsOptions): CommandSpec[] {
  return [
    {
      id: 'cropLibrary.focusSearch',
      label: labels.focusSearch,
      group: 'navigation',
      keywords: ['kulturbibliothek', 'kultur', 'suchen', 'search', 'filter'],
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['cropLibrary'],
      isEnabled: () => true,
      action: focusSearch,
    },
    {
      id: 'cropLibrary.edit',
      label: labels.edit,
      group: 'navigation',
      keywords: ['kulturbibliothek', 'kultur', 'bearbeiten', 'edit'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['cropLibrary'],
      isEnabled: () => Boolean(selectedCulture),
      action: openEditDialog,
    },
    {
      id: 'cropLibrary.import',
      label: labels.importToProject,
      group: 'navigation',
      keywords: ['kulturbibliothek', 'kultur', 'import', 'projekt', 'übernehmen'],
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['cropLibrary'],
      isEnabled: () => Boolean(selectedCulture),
      action: importSelectedCulture,
    },
    {
      id: 'cropLibrary.showDetails',
      label: labels.showDetails,
      group: 'navigation',
      keywords: ['kulturbibliothek', 'details', 'übersicht'],
      shortcutHint: 'Alt+Shift+O',
      keys: { alt: true, shift: true, key: 'o' },
      contextTags: ['cropLibrary'],
      isEnabled: () => Boolean(selectedCulture),
      action: () => selectTab(0),
    },
    {
      id: 'cropLibrary.showVersions',
      label: labels.showVersions,
      group: 'navigation',
      keywords: ['kulturbibliothek', 'versionen', 'historie'],
      shortcutHint: 'Alt+Shift+V',
      keys: { alt: true, shift: true, key: 'v' },
      contextTags: ['cropLibrary'],
      isEnabled: () => Boolean(selectedCulture),
      action: () => selectTab(1),
    },
    {
      id: 'cropLibrary.showDiscussion',
      label: labels.showDiscussion,
      group: 'navigation',
      keywords: ['kulturbibliothek', 'diskussion', 'kommentar', 'comments'],
      shortcutHint: 'Alt+Shift+C',
      keys: { alt: true, shift: true, key: 'c' },
      contextTags: ['cropLibrary'],
      isEnabled: () => Boolean(selectedCulture),
      action: () => selectTab(2),
    },
    {
      id: 'cropLibrary.previous',
      label: labels.previous,
      group: 'navigation',
      keywords: ['kulturbibliothek', 'vorherige', 'kultur', 'left'],
      shortcutHint: 'Alt+Shift+←',
      keys: { alt: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['cropLibrary'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCultureId),
      action: () => goToRelativeCulture('previous'),
    },
    {
      id: 'cropLibrary.next',
      label: labels.next,
      group: 'navigation',
      keywords: ['kulturbibliothek', 'nächste', 'kultur', 'right'],
      shortcutHint: 'Alt+Shift+→',
      keys: { alt: true, shift: true, key: 'ArrowRight' },
      contextTags: ['cropLibrary'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCultureId),
      action: () => goToRelativeCulture('next'),
    },
  ];
}
