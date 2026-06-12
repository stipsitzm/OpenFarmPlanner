export type CultivationPlanRequirementStep = 'fields' | 'beds' | 'cultures' | null;
export type ProjectSetupStep = 'fields' | 'beds' | 'cultures' | 'plans';

export interface ProjectSetupAction {
  labelKey: string;
  to: string;
}

const PROJECT_SETUP_ACTIONS: Record<ProjectSetupStep, ProjectSetupAction> = {
  fields: { labelKey: 'common:setupActions.createField', to: '/app/fields-beds?action=add-parcel' },
  beds: { labelKey: 'common:setupActions.openAreas', to: '/app/fields-beds' },
  cultures: { labelKey: 'common:setupActions.createCulture', to: '/app/cultures?create=true' },
  plans: { labelKey: 'common:setupActions.createPlan', to: '/app/planting-plans?create=true' },
};

const CULTURE_SETUP_ACTIONS: ProjectSetupAction[] = [
  { labelKey: 'common:setupActions.openCultureLibrary', to: '/app/cultures?library=true' },
  PROJECT_SETUP_ACTIONS.cultures,
];

interface CultivationPlanRequirementState {
  hasFields: boolean;
  hasBeds: boolean;
  hasCultures: boolean;
}

interface ProjectSetupState {
  hasFields: boolean;
  hasBeds: boolean;
  hasCultures: boolean;
  hasPlans: boolean;
}

export function getFirstMissingProjectSetupStep(state: ProjectSetupState): ProjectSetupStep | null {
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
  if (!state.hasFields) return 'fields';
  if (!state.hasBeds) return 'beds';
  if (!state.hasCultures) return 'cultures';
  return null;
}
