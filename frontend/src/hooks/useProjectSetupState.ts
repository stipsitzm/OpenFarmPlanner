export interface ProjectSetupStateInput {
  locationsCount: number;
  fieldsCount: number;
  bedsCount: number;
  culturesCount: number;
  plantingPlansCount: number;
  suppliersCount?: number;
}

export interface ProjectSetupState {
  hasLocations: boolean;
  hasFields: boolean;
  hasBeds: boolean;
  hasCultures: boolean;
  hasPlantingPlans: boolean;
  hasSuppliers: boolean;
  missingForPlantingPlans: Array<'cultures' | 'beds'>;
}

export const deriveProjectSetupState = (input: ProjectSetupStateInput): ProjectSetupState => {
  const hasLocations = input.locationsCount > 0;
  const hasFields = input.fieldsCount > 0;
  const hasBeds = input.bedsCount > 0;
  const hasCultures = input.culturesCount > 0;
  const hasPlantingPlans = input.plantingPlansCount > 0;
  const hasSuppliers = (input.suppliersCount ?? 0) > 0;
  const missingForPlantingPlans: Array<'cultures' | 'beds'> = [];
  if (!hasCultures) missingForPlantingPlans.push('cultures');
  if (!hasBeds) missingForPlantingPlans.push('beds');

  return {
    hasLocations,
    hasFields,
    hasBeds,
    hasCultures,
    hasPlantingPlans,
    hasSuppliers,
    missingForPlantingPlans,
  };
};
