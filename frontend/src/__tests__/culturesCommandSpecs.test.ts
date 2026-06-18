import { describe, expect, it, vi } from 'vitest';
import type { Culture } from '../api/api';
import { createCulturesCommandSpecs } from '../pages/culturesCommandSpecs';

const labels: Record<string, string> = {
  'commands.edit': 'Kultur bearbeiten',
  'commands.delete': 'Kultur löschen',
  'commands.exportCurrent': 'Aktuelle Kultur exportieren',
  'commands.exportAll': 'Alle Kulturen exportieren',
  'commands.import': 'Kulturen importieren',
  'commands.createPlan': 'Anbauplan erstellen',
  'commands.aiCompleteCurrent': 'Kultur per KI vervollständigen',
  'commands.aiReresearchCurrent': 'Kultur per KI neu recherchieren',
  'commands.aiCompleteAll': 'Alle Kulturen per KI vervollständigen',
  'commands.previous': 'Vorherige Kultur',
  'commands.next': 'Nächste Kultur',
};

function createCommands() {
  const selectedCulture: Culture = { id: 1, name: 'Tomate' };
  const callbacks = {
    handleExportCurrentCulture: vi.fn(),
    handleExportAllCultures: vi.fn().mockResolvedValue(undefined),
    handleImportFileTrigger: vi.fn(),
  };
  const commands = createCulturesCommandSpecs({
    canRunEnrichmentForCulture: () => true,
    cultures: [selectedCulture, { id: 2, name: 'Salat' }],
    enableAiEnrichment: true,
    enrichmentLoading: false,
    goToRelativeCulture: vi.fn(),
    handleCreatePlantingPlan: vi.fn(),
    handleDelete: vi.fn(),
    handleEdit: vi.fn(),
    handleEnrichCurrent: vi.fn().mockResolvedValue(undefined),
    ...callbacks,
    selectedCulture,
    selectedCultureId: selectedCulture.id,
    setEnrichAllConfirmOpen: vi.fn(),
    t: (key) => labels[key] ?? key,
  });

  return { callbacks, commands };
}

describe('culture command specs', () => {
  it('uses format-neutral localized import and export labels', () => {
    const { commands } = createCommands();

    expect(commands.find((command) => command.id === 'culture.exportCurrent')?.label)
      .toBe('Aktuelle Kultur exportieren');
    expect(commands.find((command) => command.id === 'culture.exportAll')?.label)
      .toBe('Alle Kulturen exportieren');
    expect(commands.find((command) => command.id === 'culture.import')?.label)
      .toBe('Kulturen importieren');
    expect(commands.map((command) => command.label).join(' ')).not.toContain('JSON');
  });

  it('keeps import and export shortcuts unique and connected to their actions', async () => {
    const { callbacks, commands } = createCommands();
    const shortcutKeys = commands
      .filter((command) => command.keys)
      .map((command) => JSON.stringify(command.keys));

    expect(new Set(shortcutKeys).size).toBe(shortcutKeys.length);

    await commands.find((command) => command.id === 'culture.exportCurrent')?.action();
    await commands.find((command) => command.id === 'culture.exportAll')?.action();
    await commands.find((command) => command.id === 'culture.import')?.action();

    expect(callbacks.handleExportCurrentCulture).toHaveBeenCalledTimes(1);
    expect(callbacks.handleExportAllCultures).toHaveBeenCalledTimes(1);
    expect(callbacks.handleImportFileTrigger).toHaveBeenCalledTimes(1);
  });

  it('groups culture actions separately from culture navigation', () => {
    const { commands } = createCommands();

    expect(commands.find((command) => command.id === 'culture.import')?.group).toBe('culture');
    expect(commands.find((command) => command.id === 'culture.edit')?.group).toBe('culture');
    expect(commands.find((command) => command.id === 'culture.previous')?.group).toBe('navigation');
    expect(commands.find((command) => command.id === 'culture.next')?.group).toBe('navigation');
  });
});
