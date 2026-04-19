import { useMemo } from "react";
import { useAuth } from "../auth/useAuth";

export type MissingProjectReason = "no_projects" | "no_active_project";

export interface ProjectRequirementState {
  isAuthLoading: boolean;
  hasAnyProjects: boolean;
  hasActiveProject: boolean;
  shouldShowProjectRequiredState: boolean;
  missingProjectReason: MissingProjectReason | null;
}

export function useProjectRequirement(): ProjectRequirementState {
  const { user, isLoading, activeProjectId } = useAuth();

  return useMemo(() => {
    const memberships = user?.memberships ?? [];
    const hasAnyProjects = memberships.length > 0;
    const hasActiveProject = typeof activeProjectId === "number" && activeProjectId > 0;
    const shouldShowProjectRequiredState = !isLoading && !hasActiveProject;
    const missingProjectReason: MissingProjectReason | null = shouldShowProjectRequiredState
      ? (hasAnyProjects ? "no_active_project" : "no_projects")
      : null;

    return {
      isAuthLoading: isLoading,
      hasAnyProjects,
      hasActiveProject,
      shouldShowProjectRequiredState,
      missingProjectReason,
    };
  }, [activeProjectId, isLoading, user?.memberships]);
}
