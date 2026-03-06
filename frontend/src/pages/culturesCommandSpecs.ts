import type { Culture } from '../api/api';
import type { CommandSpec } from '../commands/types';

export type CreateCulturesCommandSpecsOptions = {
  canRunEnrichmentForCulture: (culture?: Culture | null) => boolean;
  cultures: Culture[];
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
  return [
    {
      id: 'culture.edit',
      title: 'Kultur bearbeiten (Alt+E)',
      keywords: ['kultur', 'bearbeiten', 'edit'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['cultures'],
      isAvailable: () => Boolean(selectedCulture),
      run: () => {
        if (selectedCulture) {
          handleEdit(selectedCulture);
        }
      },
    },
    {
      id: 'culture.delete',
      title: 'Kultur löschen (Alt+Shift+D)',
      keywords: ['kultur', 'löschen', 'delete'],
      shortcutHint: 'Alt+Shift+D',
      keys: { alt: true, shift: true, key: 'd' },
      contextTags: ['cultures'],
      isAvailable: () => Boolean(selectedCulture),
      run: () => {
        if (selectedCulture) {
          handleDelete(selectedCulture);
        }
      },
    },
    {
      id: 'culture.exportCurrent',
      title: 'JSON exportieren (Alt+J)',
      keywords: ['json', 'export', 'kultur'],
      shortcutHint: 'Alt+J',
      keys: { alt: true, key: 'j' },
      contextTags: ['cultures'],
      isAvailable: () => Boolean(selectedCulture),
      run: handleExportCurrentCulture,
    },
    {
      id: 'culture.exportAll',
      title: 'Alle Kulturen exportieren (Alt+Shift+J)',
      keywords: ['json', 'export', 'alle', 'kulturen'],
      shortcutHint: 'Alt+Shift+J',
      keys: { alt: true, shift: true, key: 'j' },
      contextTags: ['cultures'],
      isAvailable: () => true,
      run: handleExportAllCultures,
    },
    {
      id: 'culture.import',
      title: 'JSON importieren (Alt+I)',
      keywords: ['json', 'import'],
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['cultures'],
      isAvailable: () => true,
      run: handleImportFileTrigger,
    },
    {
      id: 'culture.createPlan',
      title: 'Anbauplan erstellen (Alt+P)',
      keywords: ['anbauplan', 'planting', 'plan'],
      shortcutHint: 'Alt+P',
      keys: { alt: true, key: 'p' },
      contextTags: ['cultures'],
      isAvailable: () => Boolean(selectedCultureId),
      run: handleCreatePlantingPlan,
    },
    {
      id: 'culture.aiCompleteCurrent',
      title: 'Kultur per KI vervollständigen (Alt+U)',
      keywords: ['ki', 'ai', 'vervollständigen', 'complete', 'kultur'],
      shortcutHint: 'Alt+U',
      keys: { alt: true, key: 'u' },
      contextTags: ['cultures'],
      isAvailable: () => Boolean(selectedCulture) && canRunEnrichmentForCulture(selectedCulture) && !enrichmentLoading,
      run: () => {
        void handleEnrichCurrent('complete');
      },
    },
    {
      id: 'culture.aiReresearchCurrent',
      title: 'Kultur per KI neu recherchieren (Alt+R)',
      keywords: ['ki', 'ai', 'recherche', 'reresearch', 'kultur'],
      shortcutHint: 'Alt+R',
      keys: { alt: true, key: 'r' },
      contextTags: ['cultures'],
      isAvailable: () => Boolean(selectedCulture) && canRunEnrichmentForCulture(selectedCulture) && !enrichmentLoading,
      run: () => {
        void handleEnrichCurrent('reresearch');
      },
    },
    {
      id: 'culture.aiCompleteAll',
      title: 'Alle Kulturen per KI vervollständigen (Alt+A)',
      keywords: ['ki', 'ai', 'alle', 'kulturen', 'vervollständigen'],
      shortcutHint: 'Alt+A',
      keys: { alt: true, key: 'a' },
      contextTags: ['cultures'],
      isAvailable: () => cultures.some((culture) => canRunEnrichmentForCulture(culture)) && !enrichmentLoading,
      run: () => setEnrichAllConfirmOpen(true),
    },
    {
      id: 'culture.previous',
      title: 'Vorherige Kultur (Alt+Shift+←)',
      keywords: ['vorherige', 'kultur', 'left'],
      shortcutHint: 'Alt+Shift+←',
      keys: { alt: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['cultures'],
      isAvailable: () => cultures.length > 1 && Boolean(selectedCultureId),
      run: () => goToRelativeCulture('previous'),
    },
    {
      id: 'culture.next',
      title: 'Nächste Kultur (Alt+Shift+→)',
      keywords: ['nächste', 'kultur', 'right'],
      shortcutHint: 'Alt+Shift+→',
      keys: { alt: true, shift: true, key: 'ArrowRight' },
      contextTags: ['cultures'],
      isAvailable: () => cultures.length > 1 && Boolean(selectedCultureId),
      run: () => goToRelativeCulture('next'),
    },
  ];
}
