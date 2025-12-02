import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Culture {
  id?: number;
  name: string;
  variety?: string;
  days_to_harvest: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Location {
  id?: number;
  name: string;
  address?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Field {
  id?: number;
  name: string;
  location: number;
  location_name?: string;
  area_sqm?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Bed {
  id?: number;
  name: string;
  field: number;
  field_name?: string;
  length_m?: number;
  width_m?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PlantingPlan {
  id?: number;
  culture: number;
  culture_name?: string;
  bed: number;
  bed_name?: string;
  planting_date: string;
  harvest_date?: string;
  quantity?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Task {
  id?: number;
  title: string;
  description?: string;
  planting_plan?: number;
  planting_plan_name?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// API functions
export const cultureAPI = {
  list: () => api.get<PaginatedResponse<Culture>>('/cultures/'),
  get: (id: number) => api.get<Culture>(`/cultures/${id}/`),
  create: (data: Culture) => api.post<Culture>('/cultures/', data),
  update: (id: number, data: Culture) => api.put<Culture>(`/cultures/${id}/`, data),
  delete: (id: number) => api.delete(`/cultures/${id}/`),
};

export const bedAPI = {
  list: () => api.get<PaginatedResponse<Bed>>('/beds/'),
  get: (id: number) => api.get<Bed>(`/beds/${id}/`),
  create: (data: Bed) => api.post<Bed>('/beds/', data),
  update: (id: number, data: Bed) => api.put<Bed>(`/beds/${id}/`, data),
  delete: (id: number) => api.delete(`/beds/${id}/`),
};

export const plantingPlanAPI = {
  list: () => api.get<PaginatedResponse<PlantingPlan>>('/planting-plans/'),
  get: (id: number) => api.get<PlantingPlan>(`/planting-plans/${id}/`),
  create: (data: PlantingPlan) => api.post<PlantingPlan>('/planting-plans/', data),
  update: (id: number, data: PlantingPlan) => api.put<PlantingPlan>(`/planting-plans/${id}/`, data),
  delete: (id: number) => api.delete(`/planting-plans/${id}/`),
};

export const fieldAPI = {
  list: () => api.get<PaginatedResponse<Field>>('/fields/'),
  get: (id: number) => api.get<Field>(`/fields/${id}/`),
  create: (data: Field) => api.post<Field>('/fields/', data),
  update: (id: number, data: Field) => api.put<Field>(`/fields/${id}/`, data),
  delete: (id: number) => api.delete(`/fields/${id}/`),
};

export const locationAPI = {
  list: () => api.get<PaginatedResponse<Location>>('/locations/'),
  get: (id: number) => api.get<Location>(`/locations/${id}/`),
  create: (data: Location) => api.post<Location>('/locations/', data),
  update: (id: number, data: Location) => api.put<Location>(`/locations/${id}/`, data),
  delete: (id: number) => api.delete(`/locations/${id}/`),
};

export const taskAPI = {
  list: () => api.get<PaginatedResponse<Task>>('/tasks/'),
  get: (id: number) => api.get<Task>(`/tasks/${id}/`),
  create: (data: Task) => api.post<Task>('/tasks/', data),
  update: (id: number, data: Task) => api.put<Task>(`/tasks/${id}/`, data),
  delete: (id: number) => api.delete(`/tasks/${id}/`),
};

export default api;
