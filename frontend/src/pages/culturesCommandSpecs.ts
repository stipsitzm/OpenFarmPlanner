import type { Culture } from '../api/api';
import type { CommandSpec } from '../commands/types';

type CultureCommandTranslator = (key: string) => string;

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
  t: CultureCommandTranslator;
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
  t,
}: CreateCulturesCommandSpecsOptions): CommandSpec[] {
  const aiCommands: CommandSpec[] = enableAiEnrichment ? [
    {
      id: 'culture.aiCompleteCurrent',
      label: t('commands.aiCompleteCurrent'),
      group: 'culture',
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
      label: t('commands.aiReresearchCurrent'),
      group: 'culture',
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
      label: t('commands.aiCompleteAll'),
      group: 'culture',
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
      label: t('commands.edit'),
      group: 'culture',
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
      label: t('commands.delete'),
      group: 'culture',
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
      label: t('commands.exportCurrent'),
      group: 'culture',
      keywords: ['export', 'kultur', 'xlsx', 'ods', 'csv', 'json'],
      shortcutHint: 'Alt+X',
      keys: { alt: true, key: 'x' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture),
      action: handleExportCurrentCulture,
    },
    {
      id: 'culture.exportAll',
      label: t('commands.exportAll'),
      group: 'culture',
      keywords: ['export', 'alle', 'kulturen', 'xlsx', 'ods', 'csv', 'json'],
      shortcutHint: 'Alt+Shift+X',
      keys: { alt: true, shift: true, key: 'x' },
      contextTags: ['cultures'],
      isEnabled: () => true,
      action: handleExportAllCultures,
    },
    {
      id: 'culture.import',
      label: t('commands.import'),
      group: 'culture',
      keywords: ['import', 'kulturen', 'xlsx', 'ods', 'csv', 'json'],
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['cultures'],
      isEnabled: () => true,
      action: handleImportFileTrigger,
    },
    {
      id: 'culture.createPlan',
      label: t('commands.createPlan'),
      group: 'culture',
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
      label: t('commands.previous'),
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
      label: t('commands.next'),
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
