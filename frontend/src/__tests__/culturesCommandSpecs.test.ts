import { describe, expect, it, vi } from 'vitest';
import { createCulturesCommandSpecs } from '../pages/culturesCommandSpecs';

function buildOptions(overrides: Partial<Parameters<typeof createCulturesCommandSpecs>[0]> = {}) {
  return {
    cultures: [],
    focusSearch: vi.fn(),
    goToRelativeCulture: vi.fn(),
    handleCreatePlantingPlan: vi.fn(),
    handleDelete: vi.fn(),
    handleEdit: vi.fn(),
    handleExportAllCultures: vi.fn(),
    handleExportCurrentCulture: vi.fn(),
    handleImportFileTrigger: vi.fn(),
    ...overrides,
  };
}

describe('createCulturesCommandSpecs', () => {
  it('registers a culture.focusSearch command bound to /', () => {
    const options = buildOptions();
    const commands = createCulturesCommandSpecs(options);
    const focusSearchCommand = commands.find((command) => command.id === 'culture.focusSearch');

    expect(focusSearchCommand).toBeDefined();
    expect(focusSearchCommand?.keys).toEqual({ key: '/' });
    expect(focusSearchCommand?.shortcutHint).toBe('/');
    expect(focusSearchCommand?.isEnabled?.()).toBe(true);

    focusSearchCommand?.action();
    expect(options.focusSearch).toHaveBeenCalledTimes(1);
  });
});
