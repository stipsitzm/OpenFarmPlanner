import { describe, expect, it } from 'vitest';
import cultures from '../i18n/locales/de/cultures.json';
import fields from '../i18n/locales/de/fields.json';
import ganttChart from '../i18n/locales/de/ganttChart.json';
import hierarchy from '../i18n/locales/de/hierarchy.json';
import plantingPlans from '../i18n/locales/de/plantingPlans.json';

describe('German tooltip copy', () => {
  it('uses calculation terms that match the culture timing fields', () => {
    expect(cultures.form.growthDurationDays).toBe('Wachstumszeit (Tage)');
    expect(cultures.form.growthDurationDaysHelp).toContain('Pflanzdatum');
    expect(cultures.form.growthDurationDaysHelp).toContain('Erntebeginn');
    expect(cultures.form.harvestDurationDays).toBe('Erntezeit (Tage)');
    expect(cultures.form.harvestDurationDaysHelp).toContain('Ernteende');
    expect(plantingPlans.tooltips.missingGrowthAndHarvestDuration).toContain('Wachstumszeit');
    expect(plantingPlans.tooltips.missingGrowthAndHarvestDuration).toContain('Erntezeit');
  });

  it('explains why hierarchy and package values are unavailable', () => {
    expect(hierarchy.messages.missingDimensionsCellTooltip).toContain('Flächenberechnung');
    expect(hierarchy.messages.missingDimensionsCellTooltip).toContain('Planungen');
    expect(cultures.seedDemand.noSupplierConfiguredTooltip).toContain('Bestellinformationen');
    expect(cultures.seedDemand.noPackagesAvailableTooltip).toContain('ausgewählten Lieferanten');
    expect(cultures.seedDemand.packageBlockers.unitConversionUnavailable).toContain('Tausendkorngewicht (TKG)');
  });

  it('uses localized, explicit labels for graphical controls', () => {
    expect(fields.graphical.zoomIn).toBe('Hineinzoomen');
    expect(fields.graphical.zoomOut).toBe('Herauszoomen');
    expect(fields.graphical.panLeft).toBe('Ansicht nach links verschieben');
    expect(ganttChart.chartLocaleText.actions).toBe('Aktionen');
    expect(ganttChart.chartLocaleText.adjustProgress).toBe('Fortschritt durch Ziehen anpassen');
  });
});
