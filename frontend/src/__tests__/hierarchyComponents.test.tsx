import { describe, expect, it } from 'vitest';
import {
  isCompletelyEmptyNewHierarchyRow,
  isPartiallyFilledNamelessNewHierarchyRow,
} from '../components/hierarchy/utils/hierarchyRowDraft';
import {
  buildHierarchyRows,
  hasPersistedEntityId,
} from '../components/hierarchy/utils/hierarchyUtils';
import { createBed, createField, createLocation } from './helpers/factories';

describe('hierarchy row projection', () => {
  it('classifies unsaved hierarchy rows without relying on grid state', () => {
    expect(isCompletelyEmptyNewHierarchyRow({
      id: -1,
      type: 'bed',
      level: 1,
      isNew: true,
      name: '',
      field: 10,
    })).toBe(true);
    expect(isCompletelyEmptyNewHierarchyRow({
      id: -1,
      type: 'bed',
      level: 1,
      isNew: true,
      name: '',
      field: 10,
      length_m: 2,
    })).toBe(false);
    expect(isPartiallyFilledNamelessNewHierarchyRow({
      id: -1,
      type: 'bed',
      level: 1,
      isNew: true,
      name: '',
      field: 10,
      length_m: 2,
    })).toBe(true);
  });

  it('recognizes only positive integer hierarchy IDs as persisted', () => {
    expect(hasPersistedEntityId(1)).toBe(true);
    expect(hasPersistedEntityId(-1)).toBe(false);
    expect(hasPersistedEntityId(0)).toBe(false);
  });

  it('renders nested rows, handles duplicate labels and expansion states', () => {
    const locations = [createLocation({ id: 1, name: 'Location' })];
    const fields = [
      createField({ id: 11, location: 1, name: 'Duplicate' }),
      createField({ id: 12, location: 1, name: 'Duplicate' }),
    ];
    const beds = [
      createBed({ id: 101, field: 11, name: 'Bed 1' }),
      createBed({ id: 102, field: 12, name: 'Bed 2' }),
    ];

    const rows = buildHierarchyRows(locations, fields, beds, new Set(['field-11', 'field-12']));

    expect(rows.filter((row) => row.type === 'field')).toHaveLength(2);
    expect(rows.filter((row) => row.name === 'Duplicate')).toHaveLength(2);
    expect(rows.filter((row) => row.type === 'bed')).toHaveLength(2);
  });

  it('handles empty and single-node tree edge cases', () => {
    expect(buildHierarchyRows([], [], [], new Set())).toEqual([]);

    const rows = buildHierarchyRows([createLocation({ id: 5 })], [], [], new Set());
    expect(rows).toHaveLength(0);
  });

  it('marks expandability only for rows with real children', () => {
    const locations = [createLocation({ id: 1, name: 'A' }), createLocation({ id: 2, name: 'B' })];
    const fields = [createField({ id: 10, location: 1, name: 'Field 10' })];
    const beds = [createBed({ id: 100, field: 10, name: 'Bed 100' })];

    const rows = buildHierarchyRows(locations, fields, beds, new Set(['location-1', 'field-10', 'location-2']));

    expect(rows.find((row) => row.id === 'location-1')?.hasChildren).toBe(true);
    expect(rows.find((row) => row.id === 'field-10')?.hasChildren).toBe(true);
    expect(rows.find((row) => row.id === 100)?.hasChildren).toBe(false);
  });
});
