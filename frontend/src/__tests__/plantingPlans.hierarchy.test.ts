import { describe, expect, it } from "vitest";
import type { Bed, Field } from "../api/types";
import {
  normalizeSelectionAfterBedChange,
  normalizeSelectionAfterFieldChange,
  normalizeSelectionAfterLocationChange,
} from "../pages/PlantingPlans";

const fields: Field[] = [
  { id: 10, name: "Parzelle Nord", location: 1 },
  { id: 20, name: "Parzelle Süd", location: 2 },
];

const beds: Bed[] = [
  { id: 100, name: "Beet 1", field: 10, area_sqm: 7 },
  { id: 200, name: "Beet 1", field: 20, area_sqm: 5 },
];

describe("PlantingPlans hierarchy normalization", () => {
  it("resets field and bed when location no longer matches", () => {
    const row = { location_id: 1, field_id: 10, bed: 100 };

    const next = normalizeSelectionAfterLocationChange(row, 2, fields, beds);

    expect(next.location_id).toBe(2);
    expect(next.field_id).toBeUndefined();
    expect(next.bed).toBe(0);
  });

  it("keeps location/field/bed aligned when field changes", () => {
    const row = { location_id: 1, field_id: 10, bed: 100 };

    const next = normalizeSelectionAfterFieldChange(row, 20, fields, beds);

    expect(next.location_id).toBe(2);
    expect(next.field_id).toBe(20);
    expect(next.bed).toBe(0);
  });

  it("fills location and field from selected bed", () => {
    const row = { location_id: 1, field_id: 10, bed: 100 };

    const next = normalizeSelectionAfterBedChange(row, 200, fields, beds);

    expect(next.location_id).toBe(2);
    expect(next.field_id).toBe(20);
    expect(next.bed).toBe(200);
  });
});
