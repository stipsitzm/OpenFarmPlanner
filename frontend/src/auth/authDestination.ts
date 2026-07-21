import type { AuthUser } from './types';

/**
 * Where to send a freshly authenticated user: straight into the app, or
 * into the project-selection/onboarding flow if they don't have a usable
 * project yet. Shared by every entry point that can hand back a fresh
 * AuthUser (login, account activation, ...) so the onboarding redirect
 * doesn't depend on which flow the user came through.
 */
export function getAuthenticatedAppDestination(user: AuthUser): string {
  const hasProjects = (user.memberships?.length ?? 0) > 0;
  return user.needs_project_selection || !hasProjects ? '/app/project-selection' : '/app';
}
