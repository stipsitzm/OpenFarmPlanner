import { describe, expect, it } from 'vitest';
import { buildSeedlingTaskGroups, buildSeedlingTooltipDetails, formatCultureDisplayLabel } from '../pages/ganttChartUtils';

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
      plantingPlanId: 12,
      targetLocationName: 'Hof',
      targetFieldName: 'Nordfeld',
      targetBedName: 'Beet A',
      propagationStartDate: new Date(2026, 3, 15),
      transplantDate: new Date(2026, 4, 10),
      propagationDurationDays: 25,
      quantity: 40,
      seedRequirementSummary: '0.045 / m²',
      notes: 'Warm kultivieren',
    });

    expect(details).toEqual([
      { labelKey: 'plan', value: '#12' },
      { labelKey: 'location', value: 'Hof / Nordfeld / Beet A' },
      { labelKey: 'propagationStart', value: '15.4.2026' },
      { labelKey: 'transplantDate', value: '10.5.2026' },
      { labelKey: 'propagationDuration', value: '25' },
      { labelKey: 'quantity', value: '40' },
      { labelKey: 'seedRequirement', value: '0.045 / m²' },
      { labelKey: 'notes', value: 'Warm kultivieren' },
    ]);

    const reducedDetails = buildSeedlingTooltipDetails({
      plantingPlanId: 12,
      notes: '   ',
    });

    expect(reducedDetails).toEqual([{ labelKey: 'plan', value: '#12' }]);
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
        },
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Tomate (Resibella)');
    expect(groups[0].tasks).toHaveLength(1);
    expect(groups[0].tasks[0].startDate.toISOString()).toContain('2026-04-19');
    expect(groups[0].tasks[0].endDate.toISOString()).toContain('2026-05-10');
    expect(groups[0].tasks[0].targetBedName).toBe('Beet A');
    expect(groups[0].tasks[0].targetFieldName).toBe('Nordfeld');
    expect(groups[0].tasks[0].targetLocationName).toBe('Hof');
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
});
