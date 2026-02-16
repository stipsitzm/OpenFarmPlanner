/**
 * Tests for hierarchy utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildHierarchyRows } from '../components/hierarchy/utils/hierarchyUtils';
import type { Location, Field, Bed } from '../api/api';

describe('buildHierarchyRows', () => {
  let mockLocations: Location[];
  let mockFields: Field[];
  let mockBeds: Bed[];
  let expandedRows: Set<string | number>;

  beforeEach(() => {
    mockLocations = [
      { id: 1, name: 'Location 1' } as Location,
      { id: 2, name: 'Location 2' } as Location,
    ];

    mockFields = [
      {
        id: 1,
        name: 'Field 1',
        location: 1,
        area_sqm: 100,
        notes: 'Notes for field 1',
      } as Field,
      {
        id: 2,
        name: 'Field 2',
        location: 1,
        area_sqm: 200,
        notes: 'Notes for field 2',
      } as Field,
      {
        id: 3,
        name: 'Field 3',
        location: 2,
        area_sqm: 150,
        notes: 'Notes for field 3',
      } as Field,
    ];

    mockBeds = [
      {
        id: 1,
        name: 'Bed 1',
        field: 1,
        area_sqm: 50,
        notes: 'Bed notes 1',
      } as Bed,
      {
        id: 2,
        name: 'Bed 2',
        field: 1,
        area_sqm: 50,
        notes: 'Bed notes 2',
      } as Bed,
      {
        id: 3,
        name: 'Bed 3',
        field: 2,
        area_sqm: 200,
        notes: 'Bed notes 3',
      } as Bed,
    ];

    expandedRows = new Set();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('should return empty array when all inputs are empty', () => {
    const result = buildHierarchyRows([], [], [], new Set());
    expect(result).toEqual([]);
  });

  it('should build single-location hierarchy with fields as top level', () => {
    const singleLocation = [mockLocations[0]];
    expandedRows.add(`field-${mockFields[0].id}`);
    expandedRows.add(`field-${mockFields[1].id}`);

    const result = buildHierarchyRows(singleLocation, mockFields.slice(0, 2), mockBeds, expandedRows);

    // Should have fields at level 0
    const topLevelFields = result.filter((r) => r.level === 0 && r.type === 'field');
    expect(topLevelFields).toHaveLength(2);
    expect(topLevelFields[0].name).toBe('Field 1');
    expect(topLevelFields[1].name).toBe('Field 2');
  });

  it('should build multi-location hierarchy with locations as top level', () => {
    expandedRows.add('location-1');

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    // Should have locations at level 0
    const topLevelLocations = result.filter((r) => r.level === 0 && r.type === 'location');
    expect(topLevelLocations).toHaveLength(2);
    expect(topLevelLocations[0].name).toBe('Location 1');
    expect(topLevelLocations[1].name).toBe('Location 2');
  });

  it('should include expanded fields under expanded locations', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const fieldsUnderLocation1 = result.filter((r) => r.parentId === 'location-1' && r.type === 'field');
    expect(fieldsUnderLocation1).toHaveLength(2); // Field 1 and Field 2
  });

  it('should hide fields under collapsed locations', () => {
    // Don't expand any locations
    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    // Should only have location rows, no fields
    const fieldRows = result.filter((r) => r.type === 'field');
    expect(fieldRows).toHaveLength(0);
  });

  it('should include beds under expanded fields', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const bedsUnderField1 = result.filter((r) => r.parentId === 'field-1' && r.type === 'bed');
    expect(bedsUnderField1).toHaveLength(2); // Bed 1 and Bed 2
  });

  it('should hide beds under collapsed fields', () => {
    expandedRows.add('location-1');
    // Don't expand field-1

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const bedsUnderField1 = result.filter((r) => r.parentId === 'field-1');
    expect(bedsUnderField1).toHaveLength(0);
  });

  it('should correctly set level property', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const locations = result.filter((r) => r.type === 'location');
    const fields = result.filter((r) => r.type === 'field');
    const beds = result.filter((r) => r.type === 'bed');

    expect(locations.every((l) => l.level === 0)).toBe(true);
    expect(fields.every((f) => f.level === 1)).toBe(true);
    expect(beds.every((b) => b.level === 2)).toBe(true);
  });

  it('should correctly set type property', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const types = new Set(result.map((r) => r.type));
    expect(types).toEqual(new Set(['location', 'field', 'bed']));
  });

  it('should correctly set parentId relationships', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const field1 = result.find((r) => r.id === 'field-1');
    expect(field1?.parentId).toBe('location-1');

    const bed1 = result.find((r) => r.type === 'bed' && r.name === 'Bed 1');
    expect(bed1?.parentId).toBe('field-1');
  });

  it('should mark beds with negative IDs as new', () => {
    const newBeds = [
      { id: -1, name: 'New Bed', field: 1, area_sqm: 50 } as Bed,
      { id: 1, name: 'Existing Bed', field: 1, area_sqm: 50 } as Bed,
    ];

    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, [mockFields[0]], newBeds, expandedRows);

    const newBed = result.find((r) => r.type === 'bed' && r.id === -1);
    const existingBed = result.find((r) => r.type === 'bed' && r.id === 1);

    expect(newBed?.isNew).toBe(true);
    expect(existingBed?.isNew).toBe(false);
  });

  it('should filter fields by location correctly', () => {
    expandedRows.add('location-1');
    expandedRows.add('location-2');

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const location1Fields = result.filter((r) => r.parentId === 'location-1' && r.type === 'field');
    const location2Fields = result.filter((r) => r.parentId === 'location-2' && r.type === 'field');

    expect(location1Fields).toHaveLength(2); // Field 1, Field 2
    expect(location2Fields).toHaveLength(1); // Field 3
  });

  it('should filter beds by field correctly', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);
    expandedRows.add(`field-2`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const bedsUnderField1 = result.filter((r) => r.parentId === 'field-1' && r.type === 'bed');
    const bedsUnderField2 = result.filter((r) => r.parentId === 'field-2' && r.type === 'bed');

    expect(bedsUnderField1).toHaveLength(2); // Bed 1, Bed 2
    expect(bedsUnderField2).toHaveLength(1); // Bed 3
  });

  it('should preserve area_sqm property', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const field = result.find((r) => r.id === 'field-1');
    const bed = result.find((r) => r.type === 'bed' && r.name === 'Bed 1');

    expect(field?.area_sqm).toBe(100);
    expect(bed?.area_sqm).toBe(50);
  });

  it('should preserve notes property', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const field = result.find((r) => r.id === 'field-1');
    const bed = result.find((r) => r.type === 'bed' && r.name === 'Bed 1');

    expect(field?.notes).toBe('Notes for field 1');
    expect(bed?.notes).toBe('Bed notes 1');
  });

  it('should handle fields with no beds', () => {
    const fieldWithNoBeds = [mockFields[0]];

    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, fieldWithNoBeds, [], expandedRows);

    const bedRows = result.filter((r) => r.type === 'bed');
    expect(bedRows).toHaveLength(0);

    const fieldRows = result.filter((r) => r.type === 'field');
    expect(fieldRows).toHaveLength(1);
  });

  it('should handle locations with no fields', () => {
    const locationWithNoFields = [mockLocations[1]]; // Location 2
    const fieldsForLocation2 = mockFields.filter((f) => f.location === 2);

    expandedRows.add(`field-3`);

    const result = buildHierarchyRows(locationWithNoFields, fieldsForLocation2, mockBeds, expandedRows);

    // With only 1 location, fields are shown at top level (not locations)
    const fieldRows = result.filter((r) => r.type === 'field');
    expect(fieldRows).toHaveLength(1); // Field 3 at top level

    const locationRows = result.filter((r) => r.type === 'location');
    expect(locationRows).toHaveLength(0); // No location rows when single location
  });

  it('should set expanded state based on expandedRows Set', () => {
    expandedRows.add('location-1');
    // Don't add location-2

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const location1 = result.find((r) => r.id === 'location-1');
    const location2 = result.find((r) => r.id === 'location-2');

    expect(location1?.expanded).toBe(true);
    expect(location2?.expanded).toBe(false);
  });

  it('should set locationId on all hierarchy rows', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    result.forEach((row) => {
      expect(row.locationId).toBeDefined();
    });
  });

  it('should set fieldId on field and bed rows', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const fieldRows = result.filter((r) => r.type === 'field' || r.type === 'bed');
    fieldRows.forEach((row) => {
      expect(row.fieldId).toBeDefined();
    });
  });

  it('should set bedId on bed rows', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const bedRows = result.filter((r) => r.type === 'bed');
    bedRows.forEach((row) => {
      expect(row.bedId).toBeDefined();
    });
  });

  it('should set field_name on bed rows', () => {
    expandedRows.add('location-1');
    expandedRows.add(`field-1`);

    const result = buildHierarchyRows(mockLocations, mockFields, mockBeds, expandedRows);

    const bed1 = result.find((r) => r.type === 'bed' && r.name === 'Bed 1');
    expect(bed1?.field_name).toBe('Field 1');
  });
});
