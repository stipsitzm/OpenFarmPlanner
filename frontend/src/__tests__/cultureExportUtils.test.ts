import { describe, expect, it } from 'vitest';
import { buildAllCulturesExport, buildSingleCultureExport, toPortableCulture } from '../cultures/exportUtils';
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
