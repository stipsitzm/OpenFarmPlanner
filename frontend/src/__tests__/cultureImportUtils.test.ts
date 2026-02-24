import { describe, expect, it } from 'vitest';
import { normalizeImportCultureEntry, parseCultureImportJson } from '../cultures/importUtils';

describe('culture import utils', () => {
  it('parses new single-culture export envelope and maps supplierName', () => {
    const parsed = parseCultureImportJson(JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-02-24',
      type: 'culture',
      culture: {
        name: 'Tomate',
        variety: 'Roma',
        supplierName: 'Bingenheimer',
        growth_duration_days: 80,
        harvest_duration_days: 20,
      },
    }));

    expect(parsed.originalCount).toBe(1);
    expect(parsed.entries[0]).toMatchObject({
      name: 'Tomate',
      variety: 'Roma',
      supplierName: 'Bingenheimer',
      supplier_name: 'Bingenheimer',
    });
  });

  it('supports legacy array format and converts meter fields to centimeters', () => {
    const entry = normalizeImportCultureEntry({
      name: 'Bohne',
      variety: 'Faraday',
      seed_supplier: 'ReinSaat',
      distance_within_row_m: 0.3,
      row_spacing_m: 0.4,
      sowing_depth_m: 0.005,
    });

    expect(entry).toMatchObject({
      supplier_name: 'ReinSaat',
      distance_within_row_cm: 30,
      row_spacing_cm: 40,
      sowing_depth_cm: 0.5,
    });
  });
});
