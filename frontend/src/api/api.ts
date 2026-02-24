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
} from './types';

export const cultureAPI = {
  list: (url = '/cultures/') => http.get<PaginatedResponse<Culture>>(url),
  get: (id: number) => http.get<Culture>(`/cultures/${id}/`),
  create: (data: Culture) => http.post<Culture>('/cultures/', data),
  update: (id: number, data: Culture) => http.put<Culture>(`/cultures/${id}/`, data),
  delete: (id: number) => http.delete(`/cultures/${id}/`),
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
};

export const supplierAPI = {
  list: (query?: string) => {
    const params = query ? { q: query } : {};
    return http.get<PaginatedResponse<Supplier>>('/suppliers/', { params });
  },
  get: (id: number) => http.get<Supplier>(`/suppliers/${id}/`),
  create: (name: string) => http.post<Supplier>('/suppliers/', { name }),
  update: (id: number, data: Supplier) => http.put<Supplier>(`/suppliers/${id}/`, data),
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
};


export const noteAttachmentAPI = {
  list: (noteId: number) => http.get<NoteAttachment[]>(`/notes/${noteId}/attachments/`),
  upload: (noteId: number, file: File, caption = '', onUploadProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('caption', caption);
    return http.post<NoteAttachment>(`/notes/${noteId}/attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
};
