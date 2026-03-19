import type { Culture } from '../api/api';
import type { CommandSpec } from '../commands/types';

export type CreateCulturesCommandSpecsOptions = {
  canRunEnrichmentForCulture: (culture?: Culture | null) => boolean;
  cultures: Culture[];
  enableAiEnrichment: boolean;
  enrichmentLoading: boolean;
  goToRelativeCulture: (direction: 'next' | 'previous') => void;
  handleCreatePlantingPlan: () => void;
  handleDelete: (culture: Culture) => void;
  handleEdit: (culture: Culture) => void;
  handleEnrichCurrent: (mode: 'complete' | 'reresearch') => Promise<void>;
  handleExportAllCultures: () => Promise<void>;
  handleExportCurrentCulture: () => void;
  handleImportFileTrigger: () => void;
  selectedCulture?: Culture;
  selectedCultureId?: number;
  setEnrichAllConfirmOpen: (open: boolean) => void;
};

export function createCulturesCommandSpecs({
  canRunEnrichmentForCulture,
  cultures,
  enableAiEnrichment,
  enrichmentLoading,
  goToRelativeCulture,
  handleCreatePlantingPlan,
  handleDelete,
  handleEdit,
  handleEnrichCurrent,
  handleExportAllCultures,
  handleExportCurrentCulture,
  handleImportFileTrigger,
  selectedCulture,
  selectedCultureId,
  setEnrichAllConfirmOpen,
}: CreateCulturesCommandSpecsOptions): CommandSpec[] {
  const aiCommands: CommandSpec[] = enableAiEnrichment ? [
    {
      id: 'culture.aiCompleteCurrent',
      label: 'Kultur per KI vervollständigen (Alt+U)',
      group: 'navigation',
      keywords: ['ki', 'ai', 'vervollständigen', 'complete', 'kultur'],
      shortcutHint: 'Alt+U',
      keys: { alt: true, key: 'u' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture) && canRunEnrichmentForCulture(selectedCulture) && !enrichmentLoading,
      action: () => {
        void handleEnrichCurrent('complete');
      },
    },
    {
      id: 'culture.aiReresearchCurrent',
      label: 'Kultur per KI neu recherchieren (Alt+R)',
      group: 'navigation',
      keywords: ['ki', 'ai', 'recherche', 'reresearch', 'kultur'],
      shortcutHint: 'Alt+R',
      keys: { alt: true, key: 'r' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture) && canRunEnrichmentForCulture(selectedCulture) && !enrichmentLoading,
      action: () => {
        void handleEnrichCurrent('reresearch');
      },
    },
    {
      id: 'culture.aiCompleteAll',
      label: 'Alle Kulturen per KI vervollständigen (Alt+A)',
      group: 'navigation',
      keywords: ['ki', 'ai', 'alle', 'kulturen', 'vervollständigen'],
      shortcutHint: 'Alt+A',
      keys: { alt: true, key: 'a' },
      contextTags: ['cultures'],
      isEnabled: () => cultures.some((culture) => canRunEnrichmentForCulture(culture)) && !enrichmentLoading,
      action: () => setEnrichAllConfirmOpen(true),
    },
  ] : [];

  return [
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
      label: 'JSON exportieren (Alt+J)',
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
      label: 'Alle Kulturen exportieren (Alt+Shift+J)',
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
      label: 'JSON importieren (Alt+I)',
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
    ...aiCommands,
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
