import { describe, expect, it } from "vitest";
import type { Bed } from "../api/types";
import { buildMobileCreateForm, getVisibleMobileRows } from "../pages/PlantingPlans";

describe("PlantingPlans mobile create helpers", () => {
  it("prefills selected bed and area in the mobile create form", () => {
    const beds: Bed[] = [
      {
        id: 12,
        name: "1 Lichtwurzel",
        field: 4,
        field_name: "11 Frucht",
        area_sqm: 12,
      },
    ];

    const form = buildMobileCreateForm("de-DE", beds, { bedId: 12 });

    expect(form.bed).toBe("12");
    expect(form.area_m2).toBe("12");
    expect(form.cultivation_type).toBe("pre_cultivation");
  });

  it("filters draft rows from mobile card rendering", () => {
    const rows = [
      { id: 1, isNew: false, culture: 1, bed: 1, planting_date: "2026-04-01" },
      { id: -1, isNew: true, culture: 0, bed: 0, planting_date: "" },
    ] as Array<{
      id: number;
      isNew: boolean;
      culture: number;
      bed: number;
      planting_date: string;
    }>;

    const visibleRows = getVisibleMobileRows(rows as never);

    expect(visibleRows).toHaveLength(1);
    expect(visibleRows[0].id).toBe(1);
  });
});
