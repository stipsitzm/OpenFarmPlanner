import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildHierarchyRows } from '../components/hierarchy/utils/hierarchyUtils';

describe('buildHierarchyRows', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds multi-location hierarchy with expandable levels', () => {
    const locations = [
      { id: 1, name: 'Nord' },
      { id: 2, name: 'Süd' },
    ] as never[];
    const fields = [
      { id: 10, name: 'Feld A', location: 1, area_sqm: 100, notes: 'A' },
      { id: 20, name: 'Feld B', location: 2, area_sqm: 200, notes: 'B' },
    ] as never[];
    const beds = [
      { id: -1, name: 'Beet neu', field: 10, area_sqm: 5, notes: 'n' },
      { id: 2, name: 'Beet 2', field: 10, area_sqm: 10, notes: 'x' },
    ] as never[];

    const rows = buildHierarchyRows(
      locations,
      fields,
      beds,
      new Set(['location-1', 'field-10'])
    );

    expect(rows[0]).toMatchObject({ type: 'location', id: 'location-1', expanded: true });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'field', id: 'field-10', level: 1 }),
        expect.objectContaining({ type: 'bed', id: -1, level: 2, isNew: true }),
        expect.objectContaining({ type: 'bed', id: 2, level: 2, isNew: false }),
      ])
    );

    // second location collapsed by default -> no nested field rows for it
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'location', id: 'location-2', expanded: false }),
      ])
    );
    expect(rows.find((r) => (r as { id: unknown }).id === 'field-20')).toBeUndefined();
  });

  it('builds single-location mode with fields as top-level rows', () => {
    const rows = buildHierarchyRows(
      [{ id: 1, name: 'Ein Ort' }] as never[],
      [{ id: 7, name: 'Feld X', location: 1, area_sqm: 10, notes: '' }] as never[],
      [{ id: 3, name: 'Beet X', field: 7, area_sqm: 2, notes: '' }] as never[],
      new Set(['field-7'])
    );

    expect(rows[0]).toMatchObject({ type: 'field', level: 0, id: 'field-7' });
    expect(rows[1]).toMatchObject({ type: 'bed', level: 1, id: 3, fieldId: 7 });
  });
});
