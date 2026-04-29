export type RequirementStep = 'locations' | 'beds' | 'cultures' | 'plans' | null;

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
