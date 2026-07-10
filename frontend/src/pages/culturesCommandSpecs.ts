import type { Culture } from '../api/api';
import type { CommandSpec } from '../commands/types';

export type CreateCulturesCommandSpecsOptions = {
  cultures: Culture[];
  focusSearch: () => void;
  goToRelativeCulture: (direction: 'next' | 'previous') => void;
  handleCreatePlantingPlan: () => void;
  handleDelete: (culture: Culture) => void;
  handleEdit: (culture: Culture) => void;
  handleExportAllCultures: () => void;
  handleExportCurrentCulture: () => void;
  handleImportFileTrigger: () => void;
  selectedCulture?: Culture;
  selectedCultureId?: number;
};

export function createCulturesCommandSpecs({
  cultures,
  focusSearch,
  goToRelativeCulture,
  handleCreatePlantingPlan,
  handleDelete,
  handleEdit,
  handleExportAllCultures,
  handleExportCurrentCulture,
  handleImportFileTrigger,
  selectedCulture,
  selectedCultureId,
}: CreateCulturesCommandSpecsOptions): CommandSpec[] {
  return [
    {
      id: 'culture.focusSearch',
      label: 'Kultur suchen fokussieren (/)',
      group: 'navigation',
      keywords: ['kultur', 'suchen', 'search', 'filter'],
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['cultures'],
      isEnabled: () => true,
      action: focusSearch,
    },
    {
      id: 'culture.edit',
      label: 'Kultur bearbeiten (Alt+E)',
      group: 'navigation',
      keywords: ['kultur', 'bearbeiten', 'edit'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture),
      action: () => {
        if (selectedCulture) {
          handleEdit(selectedCulture);
        }
      },
    },
    {
      id: 'culture.delete',
      label: 'Kultur löschen (Alt+Shift+D)',
      group: 'navigation',
      keywords: ['kultur', 'löschen', 'delete'],
      shortcutHint: 'Alt+Shift+D',
      keys: { alt: true, shift: true, key: 'd' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture),
      action: () => {
        if (selectedCulture) {
          handleDelete(selectedCulture);
        }
      },
    },
    {
      id: 'culture.exportCurrent',
      label: (selectedCulture ? 'Aktuelle Kultur exportieren (JSON)' : 'Kulturen exportieren (JSON)') + ' (Alt+J)',
      group: 'navigation',
      keywords: ['json', 'export', 'kultur'],
      shortcutHint: 'Alt+J',
      keys: { alt: true, key: 'j' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture),
      action: handleExportCurrentCulture,
    },
    {
      id: 'culture.exportAll',
      label: 'Alle Kulturen exportieren (JSON) (Alt+Shift+J)',
      group: 'navigation',
      keywords: ['json', 'export', 'alle', 'kulturen'],
      shortcutHint: 'Alt+Shift+J',
      keys: { alt: true, shift: true, key: 'j' },
      contextTags: ['cultures'],
      isEnabled: () => true,
      action: handleExportAllCultures,
    },
    {
      id: 'culture.import',
      label: 'Kulturen importieren (JSON) (Alt+I)',
      group: 'navigation',
      keywords: ['json', 'import'],
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['cultures'],
      isEnabled: () => true,
      action: handleImportFileTrigger,
    },
    {
      id: 'culture.createPlan',
      label: 'Anbauplan erstellen (Alt+P)',
      group: 'navigation',
      keywords: ['anbauplan', 'planting', 'plan'],
      shortcutHint: 'Alt+P',
      keys: { alt: true, key: 'p' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCultureId),
      action: handleCreatePlantingPlan,
    },
    {
      id: 'culture.previous',
      label: 'Vorherige Kultur (Alt+Shift+←)',
      group: 'navigation',
      keywords: ['vorherige', 'kultur', 'left'],
      shortcutHint: 'Alt+Shift+←',
      keys: { alt: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['cultures'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCultureId),
      action: () => goToRelativeCulture('previous'),
    },
    {
      id: 'culture.next',
      label: 'Nächste Kultur (Alt+Shift+→)',
      group: 'navigation',
      keywords: ['nächste', 'kultur', 'right'],
      shortcutHint: 'Alt+Shift+→',
      keys: { alt: true, shift: true, key: 'ArrowRight' },
      contextTags: ['cultures'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCultureId),
      action: () => goToRelativeCulture('next'),
    },
  ];
}
