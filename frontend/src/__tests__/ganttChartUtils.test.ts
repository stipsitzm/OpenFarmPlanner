import { describe, expect, it } from 'vitest';
import {
  buildFieldOccupancyTaskGroups,
  buildSeedlingTaskGroups,
  buildSeedlingTooltipDetails,
  formatCultureDisplayLabel,
} from '../pages/ganttChartUtils';

const locations = [{ id: 1, name: 'Hof' }];
const fields = [{ id: 10, name: 'Nordfeld', location: 1 }];
const beds = [{ id: 100, name: 'Beet A', field: 10 }];

describe('buildSeedlingTaskGroups', () => {

  it('formats the visible label as culture and variety', () => {
    expect(formatCultureDisplayLabel('Tomate', 'Resibella')).toBe('Tomate (Resibella)');
    expect(formatCultureDisplayLabel('Tomate', '')).toBe('Tomate');
  });

  it('builds tooltip details only for available values', () => {
    const details = buildSeedlingTooltipDetails({
      propagationStartDate: new Date(2026, 3, 15),
      transplantDate: new Date(2026, 4, 10),
      propagationDurationDays: 25,
      plantsCount: 40,
      plantingPlanCount: 3,
    });

    expect(details).toEqual([
      { labelKey: 'propagationStart', value: '15.4.2026' },
      { labelKey: 'transplantDate', value: '10.5.2026' },
      { labelKey: 'propagationDuration', value: '25' },
      { labelKey: 'totalPlantsCount', value: '40' },
      { labelKey: 'plantingPlanCount', value: '3' },
    ]);

    const reducedDetails = buildSeedlingTooltipDetails({
      plantingPlanCount: 1,
    });

    expect(reducedDetails).toEqual([{ labelKey: 'plantingPlanCount', value: '1' }]);
  });

  it('builds propagation windows grouped by culture', () => {
    const groups = buildSeedlingTaskGroups({
      locations,
      fields,
      beds,
      displayYear: 2026,
      cultures: [
        {
          id: 7,
          name: 'Tomate',
          variety: 'Resibella',
          propagation_duration_days: 21,
          cultivation_type: 'pre_cultivation',
          display_color: '#ff0000',
        },
      ],
      plantingPlans: [
        {
          id: 5,
          culture: 7,
          culture_name: 'Tomate',
          bed: 100,
          bed_name: 'Beet A',
          planting_date: '2026-05-10',
          cultivation_type: 'pre_cultivation',
          area_usage_sqm: 12,
          plants_count: 18,
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Tomate (Resibella)');
    expect(groups[0].tasks).toHaveLength(1);
    expect(groups[0].tasks[0].startDate.toISOString()).toContain('2026-04-19');
    expect(groups[0].tasks[0].endDate.toISOString()).toContain('2026-05-10');
    expect(groups[0].tasks[0].targetBedName).toBeUndefined();
    expect(groups[0].tasks[0].targetFieldName).toBeUndefined();
    expect(groups[0].tasks[0].targetLocationName).toBeUndefined();
    expect(groups[0].tasks[0].targetAreaUsage).toBeUndefined();
    expect(groups[0].tasks[0].plantsCount).toBe(18);
    expect(groups[0].tasks[0].plantingPlanCount).toBe(1);
  });

  it('aggregates seedling requirements by culture, start date and transplant date independent of beds', () => {
    const groups = buildSeedlingTaskGroups({
      locations: [
        { id: 1, name: 'Hof' },
        { id: 2, name: 'Pacht' },
      ],
      fields: [
        { id: 10, name: 'Nordfeld', location: 1 },
        { id: 20, name: 'Südfeld', location: 2 },
      ],
      beds: [
        { id: 100, name: 'Beet A', field: 10 },
        { id: 200, name: 'Beet B', field: 20 },
      ],
      displayYear: 2026,
      cultures: [
        {
          id: 7,
          name: 'Gurke',
          variety: 'RS-Gu-01.25',
          propagation_duration_days: 28,
          cultivation_type: 'pre_cultivation',
        },
      ],
      plantingPlans: [
        {
          id: 1,
          culture: 7,
          culture_name: 'Gurke',
          bed: 100,
          planting_date: '2026-02-20',
          cultivation_type: 'pre_cultivation',
          plants_count: 20,
        },
        {
          id: 2,
          culture: 7,
          culture_name: 'Gurke',
          bed: 200,
          planting_date: '2026-02-20',
          cultivation_type: 'pre_cultivation',
          plants_count: 34,
        },
        {
          id: 3,
          culture: 7,
          culture_name: 'Gurke',
          bed: 100,
          planting_date: '2026-02-27',
          cultivation_type: 'pre_cultivation',
          plants_count: 12,
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Gurke (RS-Gu-01.25)');
    expect(groups[0].description).toBeUndefined();
    expect(groups[0].tasks).toHaveLength(2);
    expect(groups[0].tasks[0]).toMatchObject({
      plantsCount: 54,
      plantingPlanCount: 2,
    });
    expect(groups[0].tasks[0].name).toBe('Gurke (RS-Gu-01.25)');
    expect(groups[0].tasks[0].targetBedName).toBeUndefined();
    expect(groups[0].tasks[0].targetFieldName).toBeUndefined();
    expect(groups[0].tasks[0].targetLocationName).toBeUndefined();
    expect(groups[0].tasks[1]).toMatchObject({
      plantsCount: 12,
      plantingPlanCount: 1,
    });
  });



  it('falls back to planting plan payload when the culture list is incomplete', () => {
    const groups = buildSeedlingTaskGroups({
      locations,
      fields,
      beds,
      displayYear: 2026,
      cultures: [],
      plantingPlans: [
        {
          id: 9,
          culture: 77,
          culture_name: 'Salat',
          culture_variety: 'Bijella',
          culture_display_color: '#00aa44',
          culture_propagation_duration_days: 25,
          culture_cultivation_types: ['pre_cultivation', 'direct_sowing'],
          bed: 100,
          bed_name: 'Beet A',
          planting_date: '2026-05-10',
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Salat (Bijella)');
    expect(groups[0].tasks[0].color).toBe('#00aa44');
    expect(groups[0].tasks[0].startDate.toISOString()).toContain('2026-04-15');
  });

  it('ignores direct sowings and incomplete propagation data', () => {
    const groups = buildSeedlingTaskGroups({
      locations,
      fields,
      beds,
      displayYear: 2026,
      cultures: [
        {
          id: 7,
          name: 'Möhre',
          propagation_duration_days: 0,
          cultivation_type: 'direct_sowing',
        },
        {
          id: 8,
          name: 'Salat',
          propagation_duration_days: 14,
          cultivation_type: 'pre_cultivation',
        },
      ],
      plantingPlans: [
        {
          id: 1,
          culture: 7,
          culture_name: 'Möhre',
          bed: 100,
          planting_date: '2026-04-01',
          cultivation_type: 'direct_sowing',
        },
        {
          id: 2,
          culture: 8,
          culture_name: 'Salat',
          bed: 100,
          planting_date: '2026-04-20',
          cultivation_type: 'direct_sowing',
        },
      ],
    });

    expect(groups).toEqual([]);
  });

  it('shows variety in occupancy task labels', () => {
    const groups = buildFieldOccupancyTaskGroups({
      locations,
      fields,
      beds,
      displayYear: 2026,
      cultures: [],
      plantingPlans: [
        {
          id: 21,
          culture: 42,
          culture_name: 'Salat',
          culture_variety: 'Bijella',
          bed: 100,
          planting_date: '2026-03-01',
          harvest_date: '2026-04-15',
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].tasks).toHaveLength(1);
    expect(groups[0].tasks[0].name).toBe('Salat (Bijella)');
  });

  it('omits location level in occupancy hierarchy when only one used location exists', () => {
    const groups = buildFieldOccupancyTaskGroups({
      locations,
      fields,
      beds,
      displayYear: 2026,
      cultures: [],
      plantingPlans: [
        {
          id: 23,
          culture: 13,
          culture_name: 'Kohl',
          bed: 100,
          planting_date: '2026-03-10',
          harvest_date: '2026-04-20',
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Nordfeld / Beet A');
    expect(groups[0].description).toBe('Nordfeld / Beet A');
    expect(groups[0].hierarchyPath).toEqual(['Nordfeld', 'Beet A']);
  });

  it('includes location level in occupancy hierarchy when multiple used locations exist', () => {
    const groups = buildFieldOccupancyTaskGroups({
      locations: [
        { id: 1, name: 'Hof' },
        { id: 2, name: 'Pacht' },
      ],
      fields: [
        { id: 10, name: 'Nordfeld', location: 1 },
        { id: 20, name: 'Südfeld', location: 2 },
      ],
      beds: [
        { id: 100, name: 'Beet A', field: 10 },
        { id: 200, name: 'Beet B', field: 20 },
      ],
      displayYear: 2026,
      cultures: [],
      plantingPlans: [
        {
          id: 24,
          culture: 7,
          culture_name: 'Salat',
          bed: 100,
          planting_date: '2026-03-01',
          harvest_date: '2026-04-15',
        },
        {
          id: 25,
          culture: 8,
          culture_name: 'Tomate',
          bed: 200,
          planting_date: '2026-05-01',
          harvest_date: '2026-07-01',
        },
      ],
    });

    expect(groups).toHaveLength(2);
    expect(groups[0].hierarchyPath).toEqual(['Hof', 'Nordfeld', 'Beet A']);
    expect(groups[0].name).toBe('Hof / Nordfeld / Beet A');
    expect(groups[0].description).toBe('Hof / Nordfeld / Beet A');
    expect(groups[1].hierarchyPath).toEqual(['Pacht', 'Südfeld', 'Beet B']);
    expect(groups[1].name).toBe('Pacht / Südfeld / Beet B');
    expect(groups[1].description).toBe('Pacht / Südfeld / Beet B');
  });

  it('shows variety in occupancy harvest labels', () => {
    const groups = buildFieldOccupancyTaskGroups({
      locations,
      fields,
      beds,
      displayYear: 2026,
      cultures: [],
      plantingPlans: [
        {
          id: 22,
          culture: 42,
          culture_name: 'Salat',
          culture_variety: 'Bijella',
          bed: 100,
          planting_date: '2026-03-01',
          harvest_date: '2026-04-15',
          harvest_end_date: '2026-04-30',
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].tasks).toHaveLength(2);
    expect(groups[0].tasks[1].name).toBe('Salat (Bijella) (Ernte)');
  });
});
