import { describe, expect, it } from 'vitest';
import { buildAllCulturesExport, buildSingleCultureExport, buildSingleCultureFilename, slugifyFilenamePart, toPortableCulture } from '../cultures/exportUtils';
import type { Culture } from '../api/types';

describe('culture export mapping', () => {
  const culture: Culture = {
    id: 42,
    name: 'Tomate',
    variety: 'Roma',
    supplier: {
      id: 7,
      name: 'Bingenheimer',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    growth_duration_days: 80,
    harvest_duration_days: 30,
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-02-10T00:00:00Z',
    notes: 'Freiland',
  };

  it('removes ids and timestamps from portable culture data', () => {
    const portable = toPortableCulture(culture) as Record<string, unknown>;

    expect(portable).toMatchObject({
      name: 'Tomate',
      variety: 'Roma',
      supplierName: 'Bingenheimer',
      growth_duration_days: 80,
      harvest_duration_days: 30,
    });

    expect(portable).not.toHaveProperty('id');
    expect(portable).not.toHaveProperty('created_at');
    expect(portable).not.toHaveProperty('updated_at');
    expect(portable).not.toHaveProperty('supplier');
  });

  it('buildSingleCultureFilename uses culture name and variety, not supplier', () => {
    const date = new Date('2026-06-29T00:00:00Z');
    expect(buildSingleCultureFilename(culture, date)).toBe('kultur_tomate_roma_2026-06-29.json');
  });

  it('buildSingleCultureFilename uses "unbekannt" for empty variety but never for the name itself', () => {
    const noVariety: Culture = { ...culture, variety: undefined };
    const date = new Date('2026-06-29T00:00:00Z');
    expect(buildSingleCultureFilename(noVariety, date)).toBe('kultur_tomate_unbekannt_2026-06-29.json');
  });

  it('slugifyFilenamePart handles german umlauts and special chars', () => {
    expect(slugifyFilenamePart('Möhre & Kohl')).toBe('mohre_kohl');
    expect(slugifyFilenamePart('')).toBe('unbekannt');
    expect(slugifyFilenamePart('Anbau-Salat')).toBe('anbau_salat');
  });

  it('builds single and bulk export envelopes with schema version', () => {
    const single = buildSingleCultureExport(culture, new Date('2026-01-15T00:00:00Z'));
    const all = buildAllCulturesExport([culture], new Date('2026-01-15T00:00:00Z'));

    expect(single).toEqual({
      schemaVersion: 1,
      exportedAt: '2026-01-15',
      type: 'culture',
      culture: expect.objectContaining({ supplierName: 'Bingenheimer', variety: 'Roma' }),
    });

    expect(all).toEqual({
      schemaVersion: 1,
      exportedAt: '2026-01-15',
      type: 'cultures',
      cultures: [expect.objectContaining({ supplierName: 'Bingenheimer', variety: 'Roma' })],
    });
  });
});
