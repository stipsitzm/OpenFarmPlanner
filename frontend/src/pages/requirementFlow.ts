export type RequirementStep = 'locations' | 'beds' | 'cultures' | 'plans' | null;
export type CultivationPlanRequirementStep = 'locations' | 'fields' | 'beds' | 'cultures' | null;

interface RequirementState {
  hasLocations: boolean;
  hasBeds: boolean;
  hasCultures: boolean;
  hasPlans: boolean;
}

export function getFirstMissingRequirement(state: RequirementState): RequirementStep {
  if (!state.hasLocations) return 'locations';
  if (!state.hasBeds) return 'beds';
  if (!state.hasCultures) return 'cultures';
  if (!state.hasPlans) return 'plans';
  return null;
}

interface CultivationPlanRequirementState {
  hasLocations: boolean;
  hasFields: boolean;
  hasBeds: boolean;
  hasCultures: boolean;
}

export function getFirstMissingCultivationPlanRequirement(
  state: CultivationPlanRequirementState,
): CultivationPlanRequirementStep {
  if (!state.hasLocations) return 'locations';
  if (!state.hasFields) return 'fields';
  if (!state.hasBeds) return 'beds';
  if (!state.hasCultures) return 'cultures';
  return null;
}
