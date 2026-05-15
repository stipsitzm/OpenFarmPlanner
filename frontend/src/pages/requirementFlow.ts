export type RequirementStep = 'locations' | 'beds' | 'cultures' | 'plans' | null;
export type CultivationPlanRequirementStep = 'locations' | 'fields' | 'beds' | 'cultures' | null;
export type ProjectSetupStep = 'locations' | 'fields' | 'beds' | 'cultures' | 'plans';

export interface ProjectSetupAction {
  labelKey: string;
  to: string;
}

const PROJECT_SETUP_ACTIONS: Record<ProjectSetupStep, ProjectSetupAction> = {
  locations: { labelKey: 'common:setupActions.createLocation', to: '/app/locations?create=true' },
  fields: { labelKey: 'common:setupActions.createField', to: '/app/fields-beds?create=true' },
  beds: { labelKey: 'common:setupActions.openAreas', to: '/app/fields-beds' },
  cultures: { labelKey: 'common:setupActions.createCulture', to: '/app/cultures?create=true' },
  plans: { labelKey: 'common:setupActions.createPlan', to: '/app/planting-plans?create=true' },
};

const CULTURE_SETUP_ACTIONS: ProjectSetupAction[] = [
  { labelKey: 'common:setupActions.openCultureLibrary', to: '/app/cultures?library=true' },
  PROJECT_SETUP_ACTIONS.cultures,
];

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

interface ProjectSetupState extends RequirementState {
  hasFields: boolean;
}

export function getFirstMissingProjectSetupStep(state: ProjectSetupState): ProjectSetupStep | null {
  if (!state.hasLocations) return 'locations';
  if (!state.hasFields) return 'fields';
  if (!state.hasBeds) return 'beds';
  if (!state.hasCultures) return 'cultures';
  if (!state.hasPlans) return 'plans';
  return null;
}

export function getProjectSetupAction(step: ProjectSetupStep): ProjectSetupAction {
  return PROJECT_SETUP_ACTIONS[step];
}

export function getProjectSetupActions(step: ProjectSetupStep): ProjectSetupAction[] {
  if (step === 'cultures') {
    return CULTURE_SETUP_ACTIONS;
  }
  return [getProjectSetupAction(step)];
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
