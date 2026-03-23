import type { Bed, Culture, Field, Location, PlantingPlan } from '../api/types';

export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  color?: string;
  percent?: number;
  dependencies?: string[];
  plantingPlanId?: number;
  cultureName?: string;
  cultureVariety?: string;
  areaUsage?: number;
  notes?: string;
  harvestStartDate?: Date;
  harvestEndDate?: Date;
  propagationStartDate?: Date;
  propagationDurationDays?: number;
  transplantDate?: Date;
  targetBedName?: string;
  targetFieldName?: string;
  targetLocationName?: string;
  targetAreaUsage?: number;
  plantsCount?: number | null;
}

export interface GanttTaskGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tasks: GanttTask[];
  locationId?: number;
  fieldId?: number;
  bedId?: number;
  area?: number;
  isGroup?: boolean;
  level?: number;
}

interface BuildTaskGroupsArgs {
  locations: Location[];
  fields: Field[];
  beds: Bed[];
  plantingPlans: PlantingPlan[];
  cultures: Culture[];
  displayYear: number;
}

interface SeedlingTooltipDetail {
  labelKey: 'location' | 'bed' | 'propagationStart' | 'transplantDate' | 'propagationDuration' | 'areaUsage' | 'plantsCount';
  value: string;
}

export interface OccupancyTooltipDetail {
  labelKey: 'plantingDate' | 'harvestDate' | 'firstHarvest' | 'lastHarvest' | 'areaUsage' | 'notes';
  value: string;
}

export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getDefaultCultureColor(cultureName: string): string {
  const colors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
  ];

  let hash = 0;
  for (let i = 0; i < cultureName.length; i++) {
    hash = cultureName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getCultureColor(
  cultures: Culture[],
  cultureId: number,
  cultureName: string,
  fallbackColor?: string,
): string {
  const culture = cultures.find((entry) => entry.id === cultureId);
  return culture?.display_color || fallbackColor || getDefaultCultureColor(cultureName);
}

function getVisibleYearInterval(displayYear: number): { start: Date; end: Date } {
  return {
    start: new Date(displayYear, 0, 1),
    end: new Date(displayYear, 11, 31, 23, 59, 59),
  };
}

export function formatCultureDisplayLabel(cultureName?: string, variety?: string): string {
  const normalizedCultureName = cultureName?.trim();
  const normalizedVariety = variety?.trim();

  if (normalizedCultureName && normalizedVariety) {
    return `${normalizedCultureName} (${normalizedVariety})`;
  }
  return normalizedCultureName || normalizedVariety || 'Unbekannte Kultur';
}

export function formatSeedlingTooltipTitle(task: Pick<GanttTask, 'cultureName' | 'cultureVariety' | 'name'>): string {
  return formatCultureDisplayLabel(task.cultureName || task.name, task.cultureVariety);
}

export function formatGanttDate(value: Date): string {
  return value.toLocaleDateString('de-DE');
}

export function formatAreaSquareMeters(value: number): string {
  return `${value.toFixed(2)} m²`;
}

export function formatPlantCount(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);
}

function formatCultureLabel(culture?: Culture, fallbackName?: string): string {
  if (!culture) {
    return fallbackName || 'Unbekannte Kultur';
  }
  return formatCultureDisplayLabel(culture.name, culture.variety);
}

export function formatSeedlingLocationReference(task: Pick<GanttTask, 'targetLocationName' | 'targetFieldName'>): string | undefined {
  const parts = [task.targetLocationName, task.targetFieldName]
    .map((value) => value?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : undefined;
}


export function buildOccupancyTooltipDetails(task: Pick<
  GanttTask,
  'id' | 'startDate' | 'harvestStartDate' | 'harvestEndDate' | 'areaUsage' | 'notes'
>): OccupancyTooltipDetail[] {
  const isHarvestTask = task.id.endsWith('-harvest');
  const hasHarvestRange = Boolean(
    task.harvestStartDate
    && task.harvestEndDate
    && task.harvestEndDate.getTime() > task.harvestStartDate.getTime(),
  );

  const details: Array<OccupancyTooltipDetail | null> = [
    !isHarvestTask
      ? { labelKey: 'plantingDate', value: formatGanttDate(task.startDate) }
      : null,
    task.harvestStartDate && !hasHarvestRange
      ? { labelKey: 'harvestDate', value: formatGanttDate(task.harvestStartDate) }
      : null,
    task.harvestStartDate && hasHarvestRange
      ? { labelKey: 'firstHarvest', value: formatGanttDate(task.harvestStartDate) }
      : null,
    task.harvestEndDate && hasHarvestRange
      ? { labelKey: 'lastHarvest', value: formatGanttDate(task.harvestEndDate) }
      : null,
    typeof task.areaUsage === 'number'
      ? { labelKey: 'areaUsage', value: formatAreaSquareMeters(task.areaUsage) }
      : null,
    task.notes?.trim()
      ? { labelKey: 'notes', value: task.notes.trim() }
      : null,
  ];

  return details.filter((detail): detail is OccupancyTooltipDetail => detail !== null);
}

export function buildSeedlingTooltipDetails(task: Pick<
  GanttTask,
  | 'targetLocationName'
  | 'targetFieldName'
  | 'targetBedName'
  | 'propagationStartDate'
  | 'transplantDate'
  | 'propagationDurationDays'
  | 'targetAreaUsage'
  | 'plantsCount'
>): SeedlingTooltipDetail[] {
  const locationReference = formatSeedlingLocationReference(task);
  const bedReference = task.targetBedName?.trim();
  const details: Array<SeedlingTooltipDetail | null> = [
    locationReference
      ? { labelKey: 'location', value: locationReference }
      : null,
    bedReference
      ? { labelKey: 'bed', value: bedReference }
      : null,
    task.propagationStartDate
      ? { labelKey: 'propagationStart', value: formatGanttDate(task.propagationStartDate) }
      : null,
    task.transplantDate
      ? { labelKey: 'transplantDate', value: formatGanttDate(task.transplantDate) }
      : null,
    typeof task.propagationDurationDays === 'number'
      ? { labelKey: 'propagationDuration', value: `${task.propagationDurationDays}` }
      : null,
    typeof task.targetAreaUsage === 'number'
      ? { labelKey: 'areaUsage', value: formatAreaSquareMeters(task.targetAreaUsage) }
      : null,
    typeof task.plantsCount === 'number' && task.plantsCount > 0
      ? { labelKey: 'plantsCount', value: formatPlantCount(task.plantsCount) }
      : null,
  ];

  return details.filter((detail): detail is SeedlingTooltipDetail => detail !== null);
}

export function buildFieldOccupancyTaskGroups({
  locations,
  fields,
  beds,
  plantingPlans,
  cultures,
  displayYear,
}: BuildTaskGroupsArgs): GanttTaskGroup[] {
  if (!locations.length || !fields.length || !beds.length || !plantingPlans.length) {
    return [];
  }

  const groups: GanttTaskGroup[] = [];
  const { start: visStart, end: visEnd } = getVisibleYearInterval(displayYear);

  const bedsByField = beds.reduce<Record<number, Bed[]>>((accumulator, bed) => {
    const fieldId = bed.field;
    accumulator[fieldId] = accumulator[fieldId] ?? [];
    accumulator[fieldId].push(bed);
    return accumulator;
  }, {});

  const fieldsByLocation = fields.reduce<Record<number, Field[]>>((accumulator, field) => {
    const locationId = field.location;
    accumulator[locationId] = accumulator[locationId] ?? [];
    accumulator[locationId].push(field);
    return accumulator;
  }, {});

  locations.forEach((location) => {
    const locationId = location.id;
    if (!locationId) {
      return;
    }

    const locationFields = fieldsByLocation[locationId] ?? [];
    locationFields.forEach((field) => {
      const fieldId = field.id;
      if (!fieldId) {
        return;
      }

      const fieldBeds = bedsByField[fieldId] ?? [];
      fieldBeds.forEach((bed) => {
        const bedId = bed.id;
        if (!bedId) {
          return;
        }

        const bedPlans = plantingPlans.filter((plan) => {
          if (plan.bed !== bedId) return false;
          if (!plan.planting_date || !plan.harvest_date) return false;

          const plantingDate = parseDateString(plan.planting_date);
          const harvestDate = parseDateString(plan.harvest_date);
          return !(harvestDate < visStart || plantingDate > visEnd);
        });

        if (bedPlans.length === 0) {
          return;
        }

        const tasks: GanttTask[] = [];
        bedPlans.forEach((plan) => {
          const plantingDate = parseDateString(plan.planting_date);
          const harvestStartDate = parseDateString(plan.harvest_date!);
          const baseColor = getCultureColor(cultures, plan.culture, plan.culture_name || '', plan.culture_display_color);
          const harvestEndDate = plan.harvest_end_date
            ? parseDateString(plan.harvest_end_date)
            : harvestStartDate;

          tasks.push({
            id: `plan-${plan.id}-growth`,
            name: plan.culture_name || `Culture ${plan.culture}`,
            startDate: plantingDate,
            endDate: harvestStartDate,
            color: baseColor,
            percent: 100,
            plantingPlanId: plan.id,
            cultureName: plan.culture_name,
            areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
            notes: plan.notes,
            harvestStartDate,
            harvestEndDate,
          });

          if (harvestEndDate > harvestStartDate) {
            tasks.push({
              id: `plan-${plan.id}-harvest`,
              name: `${plan.culture_name || `Culture ${plan.culture}`} (Ernte)`,
              startDate: harvestStartDate,
              endDate: harvestEndDate,
              color: baseColor.startsWith('#') ? `${baseColor}CC` : baseColor,
              percent: 100,
              plantingPlanId: plan.id,
              cultureName: plan.culture_name,
              areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
              notes: `Erntezeitraum: ${plan.notes || ''}`.trim(),
              harvestStartDate,
              harvestEndDate,
            });
          }
        });

        groups.push({
          id: `bed-${bedId}`,
          name: bed.name,
          description: `${location.name} / ${field.name}`,
          tasks,
          locationId,
          fieldId,
          bedId,
          area: bed.area_sqm ? Number(bed.area_sqm) : undefined,
        });
      });
    });
  });

  return groups;
}

export function buildSeedlingTaskGroups({
  locations,
  fields,
  beds,
  plantingPlans,
  cultures,
  displayYear,
}: BuildTaskGroupsArgs): GanttTaskGroup[] {
  if (!plantingPlans.length) {
    return [];
  }

  const { start: visStart, end: visEnd } = getVisibleYearInterval(displayYear);
  const cultureById = new Map<number, Culture>();
  cultures.forEach((culture) => {
    if (culture.id) {
      cultureById.set(culture.id, culture);
    }
  });

  const bedById = new Map<number, Bed>();
  beds.forEach((bed) => {
    if (bed.id) {
      bedById.set(bed.id, bed);
    }
  });

  const fieldById = new Map<number, Field>();
  fields.forEach((field) => {
    if (field.id) {
      fieldById.set(field.id, field);
    }
  });

  const locationById = new Map<number, Location>();
  locations.forEach((location) => {
    if (location.id) {
      locationById.set(location.id, location);
    }
  });

  const groupsByCulture = new Map<string, GanttTaskGroup>();

  plantingPlans.forEach((plan) => {
    if (!plan.id || !plan.planting_date) {
      return;
    }

    const culture = cultureById.get(plan.culture);
    const propagationDurationDays = culture?.propagation_duration_days
      ?? plan.culture_propagation_duration_days
      ?? undefined;
    if (!propagationDurationDays || propagationDurationDays <= 0) {
      return;
    }

    const cultureCultivationType = culture?.cultivation_type || plan.culture_cultivation_type || '';
    const cultureCultivationTypes = culture?.cultivation_types || plan.culture_cultivation_types || [];
    const isPreCultivation = plan.cultivation_type === 'pre_cultivation'
      || (!plan.cultivation_type && (
        cultureCultivationType === 'pre_cultivation'
        || cultureCultivationTypes.includes('pre_cultivation')
      ));

    if (!isPreCultivation) {
      return;
    }

    const transplantDate = parseDateString(plan.planting_date);
    const propagationStartDate = new Date(transplantDate);
    propagationStartDate.setDate(propagationStartDate.getDate() - propagationDurationDays);

    if (transplantDate < visStart || propagationStartDate > visEnd) {
      return;
    }

    const bed = bedById.get(plan.bed);
    const field = bed ? fieldById.get(bed.field) : undefined;
    const location = field ? locationById.get(field.location) : undefined;
    const cultureLabel = formatCultureLabel(culture || { name: plan.culture_name || `Kultur ${plan.culture}`, variety: plan.culture_variety } as Culture, plan.culture_name);
    const groupId = `culture-${plan.culture}`;
    const group = groupsByCulture.get(groupId) ?? {
      id: groupId,
      name: cultureLabel,
      description: targetDescription(location?.name, field?.name),
      tasks: [],
    };

    group.tasks.push({
      id: `seedling-plan-${plan.id}`,
      name: cultureLabel,
      startDate: propagationStartDate,
      endDate: transplantDate,
      color: getCultureColor(cultures, plan.culture, cultureLabel, plan.culture_display_color),
      percent: 100,
      plantingPlanId: plan.id,
      cultureName: culture?.name || plan.culture_name || cultureLabel,
      cultureVariety: culture?.variety || plan.culture_variety,
      propagationStartDate,
      propagationDurationDays,
      transplantDate,
      targetBedName: bed?.name || plan.bed_name,
      targetFieldName: field?.name,
      targetLocationName: location?.name,
      targetAreaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
      areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
      plantsCount: plan.plants_count ?? null,
    });

    groupsByCulture.set(groupId, group);
  });

  return [...groupsByCulture.values()]
    .map((group) => ({
      ...group,
      tasks: [...group.tasks].sort((left, right) => left.startDate.getTime() - right.startDate.getTime()),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

function targetDescription(locationName?: string, fieldName?: string): string | undefined {
  if (locationName && fieldName) {
    return `${locationName} / ${fieldName}`;
  }
  return locationName || fieldName;
}
