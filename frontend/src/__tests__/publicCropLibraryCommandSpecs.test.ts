import { describe, expect, it, vi } from 'vitest';
import type { PublicCulture } from '../api/types';
import {
  createPublicCropLibraryCommandSpecs,
  type PublicCropLibraryCommandLabels,
} from '../crops/pages/publicCropLibraryCommandSpecs';

const labels: PublicCropLibraryCommandLabels = {
  focusSearch: 'Öffentliche Kulturen suchen',
  edit: 'Öffentliche Kultur bearbeiten',
  importToProject: 'Öffentliche Kultur in Projekt importieren',
  showDetails: 'Details anzeigen',
  showVersions: 'Versionen anzeigen',
  showDiscussion: 'Diskussion anzeigen',
  previous: 'Vorherige öffentliche Kultur',
  next: 'Nächste öffentliche Kultur',
};

const buildPublicCulture = (id: number): PublicCulture => ({
  id,
  status: 'published',
  name: `Kultur ${id}`,
  version: 1,
});

function buildOptions(overrides: Partial<Parameters<typeof createPublicCropLibraryCommandSpecs>[0]> = {}) {
  const cultures = [buildPublicCulture(1), buildPublicCulture(2)];
  return {
    cultures,
    focusSearch: vi.fn(),
    goToRelativeCulture: vi.fn(),
    importSelectedCulture: vi.fn(),
    openEditDialog: vi.fn(),
    selectTab: vi.fn(),
    selectedCulture: cultures[0],
    selectedCultureId: cultures[0].id,
    labels,
    ...overrides,
  };
}

describe('createPublicCropLibraryCommandSpecs', () => {
  it('registers the public library shortcuts that mirror useful culture page actions', () => {
    const options = buildOptions();
    const commands = createPublicCropLibraryCommandSpecs(options);

    expect(commands.find((command) => command.id === 'cropLibrary.focusSearch')?.keys).toEqual({ key: '/' });
    expect(commands.find((command) => command.id === 'cropLibrary.edit')?.keys).toEqual({ alt: true, key: 'e' });
    expect(commands.find((command) => command.id === 'cropLibrary.import')?.keys).toEqual({ alt: true, key: 'i' });
    expect(commands.find((command) => command.id === 'cropLibrary.previous')?.keys).toEqual({ alt: true, shift: true, key: 'ArrowLeft' });
    expect(commands.find((command) => command.id === 'cropLibrary.next')?.keys).toEqual({ alt: true, shift: true, key: 'ArrowRight' });
  });

  it('registers tab shortcuts without using project-culture delete or create shortcuts', () => {
    const options = buildOptions();
    const commands = createPublicCropLibraryCommandSpecs(options);

    const showDetailsCommand = commands.find((command) => command.id === 'cropLibrary.showDetails');
    const showVersionsCommand = commands.find((command) => command.id === 'cropLibrary.showVersions');
    const showDiscussionCommand = commands.find((command) => command.id === 'cropLibrary.showDiscussion');

    expect(showDetailsCommand?.keys).toEqual({ alt: true, shift: true, key: 'o' });
    expect(showVersionsCommand?.keys).toEqual({ alt: true, shift: true, key: 'v' });
    expect(showDiscussionCommand?.keys).toEqual({ alt: true, shift: true, key: 'c' });
    expect(commands.some((command) => command.shortcutHint === 'Alt+Shift+D')).toBe(false);
    expect(commands.some((command) => command.shortcutHint === 'Alt+Shift+N')).toBe(false);

    showVersionsCommand?.action();
    expect(options.selectTab).toHaveBeenCalledWith(1);
  });

  it('disables selected-culture commands when no public culture is selected', () => {
    const commands = createPublicCropLibraryCommandSpecs(buildOptions({
      selectedCulture: null,
      selectedCultureId: null,
    }));

    expect(commands.find((command) => command.id === 'cropLibrary.focusSearch')?.isEnabled?.()).toBe(true);
    expect(commands.find((command) => command.id === 'cropLibrary.edit')?.isEnabled?.()).toBe(false);
    expect(commands.find((command) => command.id === 'cropLibrary.import')?.isEnabled?.()).toBe(false);
    expect(commands.find((command) => command.id === 'cropLibrary.next')?.isEnabled?.()).toBe(false);
  });
});
