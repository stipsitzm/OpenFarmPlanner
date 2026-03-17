import http from './httpClient';
import type {
  Culture,
  Location,
  Field,
  Bed,
  PlantingPlan,
  PaginatedResponse,
  Supplier,
  SeedDemand,
  YieldCalendarWeek,
  NoteAttachment,
  CultureHistoryEntry,
  MediaFileRef,
  RemainingAreaResponse,
  EnrichmentResult,
  EnrichmentBatchResult,
  BedLayoutEntry,
  FieldLayoutEntry,
  LocationLayoutsResponse,
} from './types';

export const cultureAPI = {
  list: (url = '/cultures/') => http.get<PaginatedResponse<Culture>>(url),
  get: (id: number) => http.get<Culture>(`/cultures/${id}/`),
  create: (data: Culture) => http.post<Culture>('/cultures/', data),
  update: (id: number, data: Culture) => http.put<Culture>(`/cultures/${id}/`, data),
  delete: (id: number) => http.delete(`/cultures/${id}/`),
  history: (id: number) => http.get<CultureHistoryEntry[]>(`/cultures/${id}/history/`),
  restore: (id: number, history_id: number) => http.post<Culture>(`/cultures/${id}/restore/`, { history_id }),
  undelete: (id: number) => http.post<Culture>(`/cultures/${id}/undelete/`, {}),
  globalHistory: () => http.get<CultureHistoryEntry[]>('/history/global/'),
  globalRestore: (history_id: number) => http.post<Culture>('/history/global/restore/', { history_id }),
  projectHistory: () => http.get<CultureHistoryEntry[]>('/history/project/'),
  projectRestore: (history_id: number) => http.post<{ detail: string }>('/history/project/restore/', { history_id }),
  // Legacy import flow split into preview/apply endpoints.
  importPreview: (data: Record<string, unknown>[]) => http.post<{
    results: Array<{
      index: number;
      status: 'create' | 'update_candidate';
      matched_culture_id?: number;
      diff?: Array<{ field: string; current: unknown; new: unknown }>;
      import_data: Record<string, unknown>;
      error?: string;
    }>;
  }>('/cultures/import/preview/', data),
  importApply: (data: {
    items: Record<string, unknown>[];
    confirm_updates: boolean;
  }) => http.post<{
    created_count: number;
    updated_count: number;
    skipped_count: number;
    errors: Array<{ index: number; error: unknown }>;
  }>('/cultures/import/apply/', data),
  enrich: (id: number, mode: 'complete' | 'reresearch', signal?: AbortSignal) =>
    http.post<EnrichmentResult>(`/cultures/${id}/enrich/`, { mode }, { signal }),
  enrichBatch: (data?: { culture_ids?: number[]; limit?: number }, signal?: AbortSignal) =>
    http.post<EnrichmentBatchResult>('/cultures/enrich-batch/', {
      mode: 'complete_all',
      ...data,
    }, { signal }),
};

export const supplierAPI = {
  list: (query?: string) => {
    const params = query ? { q: query } : {};
    return http.get<PaginatedResponse<Supplier>>('/suppliers/', { params });
  },
  get: (id: number) => http.get<Supplier>(`/suppliers/${id}/`),
  create: (name: string, homepage_url: string, allowed_domains: string[] = []) => http.post<Supplier>('/suppliers/', { name, homepage_url, allowed_domains }),
  update: (id: number, data: Partial<Supplier>) => http.put<Supplier>(`/suppliers/${id}/`, data),
  delete: (id: number) => http.delete(`/suppliers/${id}/`),
};

export const bedAPI = {
  list: () => http.get<PaginatedResponse<Bed>>('/beds/'),
  get: (id: number) => http.get<Bed>(`/beds/${id}/`),
  create: (data: Bed) => http.post<Bed>('/beds/', data),
  update: (id: number, data: Bed) => http.put<Bed>(`/beds/${id}/`, data),
  delete: (id: number) => http.delete(`/beds/${id}/`),
};

export const plantingPlanAPI = {
  list: () => http.get<PaginatedResponse<PlantingPlan>>('/planting-plans/'),
  get: (id: number) => http.get<PlantingPlan>(`/planting-plans/${id}/`),
  create: (data: PlantingPlan) => http.post<PlantingPlan>('/planting-plans/', data),
  update: (id: number, data: PlantingPlan) => http.put<PlantingPlan>(`/planting-plans/${id}/`, data),
  delete: (id: number) => http.delete(`/planting-plans/${id}/`),
  remainingArea: (params: { bed_id: number; start_date: string; end_date: string; exclude_plan_id?: number }) =>
    http.get<RemainingAreaResponse>('/planting-plans/remaining-area/', { params }),
};



export const layoutAPI = {
  listByLocation: (locationId: number) => http.get<LocationLayoutsResponse>(`/locations/${locationId}/layouts/`),
  saveByLocation: (locationId: number, payload: { bed_layouts: BedLayoutEntry[]; field_layouts: FieldLayoutEntry[] }) =>
    http.put<LocationLayoutsResponse>(`/locations/${locationId}/layouts/`, payload),
};


export const mediaFileAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file, file.name || 'culture-media');
    return http.post<MediaFileRef>('/media-files/upload/', formData);
  },
};

export const noteAttachmentAPI = {
  list: (noteId: number) => http.get<NoteAttachment[]>(`/notes/${noteId}/attachments/`),
  upload: (noteId: number, file: File, caption = '', onUploadProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('image', file, file.name || 'note-attachment');
    formData.append('caption', caption);
    return http.post<NoteAttachment>(`/notes/${noteId}/attachments/`, formData, {
      onUploadProgress: (event) => {
        if (!onUploadProgress || !event.total) return;
        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
  },
  delete: (attachmentId: number) => http.delete(`/attachments/${attachmentId}/`),
};

export const seedDemandAPI = {
  list: () => http.get<PaginatedResponse<SeedDemand>>('/seed-demand/'),
};

export const yieldCalendarAPI = {
  list: (year: number) => http.get<YieldCalendarWeek[]>('/yield-calendar/', { params: { year } }),
};

export const fieldAPI = {
  list: () => http.get<PaginatedResponse<Field>>('/fields/'),
  get: (id: number) => http.get<Field>(`/fields/${id}/`),
  create: (data: Field) => http.post<Field>('/fields/', data),
  update: (id: number, data: Field) => http.put<Field>(`/fields/${id}/`, data),
  delete: (id: number) => http.delete(`/fields/${id}/`),
};

export const locationAPI = {
  list: () => http.get<PaginatedResponse<Location>>('/locations/'),
  get: (id: number) => http.get<Location>(`/locations/${id}/`),
  create: (data: Location) => http.post<Location>('/locations/', data),
  update: (id: number, data: Location) => http.put<Location>(`/locations/${id}/`, data),
  delete: (id: number) => http.delete(`/locations/${id}/`),
};

export interface ProjectPayload {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectInvitationPayload {
  id: number;
  email: string;
  role: 'admin' | 'member';
  token: string;
  status: 'pending' | 'accepted' | 'revoked';
  resolved_status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface InvitationPublicStatus {
  code: string;
  project_name?: string;
  email_masked?: string;
  requires_auth: boolean;
  expires_at?: string;
}

export const projectAPI = {
  create: (data: { name: string; description?: string }) =>
    http.post<ProjectPayload>('/projects/', data),
  invite: (projectId: number, data: { email: string; role: 'admin' | 'member' }) =>
    http.post(`/projects/${projectId}/invitations/`, data),
  listInvitations: (projectId: number) =>
    http.get<ProjectInvitationPayload[]>(`/projects/${projectId}/invitations/`),
  revokeInvitation: (projectId: number, invitationId: number) =>
    http.post(`/projects/${projectId}/invitations/${invitationId}/revoke/`),
  getInvitationStatus: (token: string) =>
    http.get<InvitationPublicStatus>(`/project-invitations/${token}/`),
  acceptInvitationByToken: (token: string) =>
    http.post<{ code: string; detail: string; project_id?: number }>(`/project-invitations/${token}/accept/`),
  acceptInvitation: (token: string) =>
    http.post<{ code: string; detail: string; project_id?: number }>('/project-invitations/accept/', { token }),
};

export type {
  Culture,
  Location,
  Field,
  Bed,
  PlantingPlan,
  PaginatedResponse,
  Supplier,
  SeedDemand,
  YieldCalendarWeek,
  NoteAttachment,
  CultureHistoryEntry,
  MediaFileRef,
  RemainingAreaResponse,
  EnrichmentResult,
  EnrichmentBatchResult,
  BedLayoutEntry,
  FieldLayoutEntry,
  LocationLayoutsResponse,
};

export default {
  cultures: cultureAPI,
  suppliers: supplierAPI,
  beds: bedAPI,
  plantingPlans: plantingPlanAPI,
  fields: fieldAPI,
  locations: locationAPI,
  seedDemand: seedDemandAPI,
  yieldCalendar: yieldCalendarAPI,
  noteAttachments: noteAttachmentAPI,
  mediaFiles: mediaFileAPI,
  layouts: layoutAPI,
  projects: projectAPI,
};
