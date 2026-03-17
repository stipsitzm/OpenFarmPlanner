export interface ProjectMembershipInfo {
  project_id: number;
  project_name: string;
  role: 'admin' | 'member';
}

export interface AuthUser {
  id: number;
  email: string;
  display_name: string;
  display_label: string;
  is_active: boolean;
  default_project_id: number | null;
  last_project_id: number | null;
  resolved_project_id: number | null;
  needs_project_selection: boolean;
  memberships: ProjectMembershipInfo[];
}
