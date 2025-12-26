/**
 * API client for the OpenFarmPlanner backend.
 * 
 * This module provides typed API functions for interacting with the Django REST API.
 * All API calls use axios and return promises with typed responses.
 */

import apiClient from './apiClient';

// ...existing code...

// apiClient wird als zentraler Axios-Client verwendet
const api = apiClient;

// Types

/**
 * Culture (crop) type that can be grown
 */
export interface Culture {
  /** Unique identifier (auto-generated) */
  id?: number;
  /** Name of the crop */
  name: string;
  /** Specific variety of the crop (optional) */
  variety?: string;
  /** Average days from planting to harvest */
  days_to_harvest: number;
  /** Additional notes */
  notes?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
  /** Growstuff API crop ID (optional) */
  growstuff_id?: number | null;
  /** Growstuff API crop slug (optional) */
  growstuff_slug?: string;
  /** Source of the crop data */
  source?: 'manual' | 'growstuff';
  /** Last time synced with Growstuff API (optional) */
  last_synced?: string | null;
  /** English Wikipedia URL (optional) */
  en_wikipedia_url?: string | null;
  /** Whether the crop is perennial (optional) */
  perennial?: boolean | null;
  /** Median lifespan in days (optional) */
  median_lifespan?: number | null;
  /** Median days to first harvest (optional) */
  median_days_to_first_harvest?: number | null;
  /** Median days to last harvest (optional) */
  median_days_to_last_harvest?: number | null;
}

/**
 * Physical location where farming occurs
 */
export interface Location {
  /** Unique identifier (auto-generated) */
  id?: number;
  /** Name of the location */
  name: string;
  /** Physical address (optional) */
  address?: string;
  /** Additional notes */
  notes?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Field within a location
 */
export interface Field {
  /** Unique identifier (auto-generated) */
  id?: number;
  /** Name of the field */
  name: string;
  /** Foreign key to Location */
  location: number;
  /** Read-only location name */
  location_name?: string;
  /** Area in square meters (optional) */
  area_sqm?: number;
  /** Additional notes */
  notes?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Bed within a field
 */
export interface Bed {
  /** Unique identifier (auto-generated) */
  id?: number;
  /** Name of the bed */
  name: string;
  /** Foreign key to Field */
  field: number;
  /** Read-only field name */
  field_name?: string;
  /** Area in square meters (optional) */
  area_sqm?: number;
  /** Additional notes */
  notes?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Planting plan linking a culture to a bed with dates
 */
export interface PlantingPlan {
  /** Unique identifier (auto-generated) */
  id?: number;
  /** Foreign key to Culture */
  culture: number;
  /** Read-only culture name */
  culture_name?: string;
  /** Foreign key to Bed */
  bed: number;
  /** Read-only bed name */
  bed_name?: string;
  /** Date when planting is scheduled */
  planting_date: string;
  /** Auto-calculated harvest start date (read-only, Erntebeginn) */
  harvest_date?: string;
  /** Auto-calculated harvest end date (read-only, Ernteende) */
  harvest_end_date?: string;
  /** Number of plants or seeds (optional) */
  quantity?: number;
  /** Area in square meters used by this planting plan (optional) */
  area_usage_sqm?: number;
  /** Additional notes */
  notes?: string;
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Farm management task
 */
export interface Task {
  /** Unique identifier (auto-generated) */
  id?: number;
  /** Short title describing the task */
  title: string;
  /** Detailed description (optional) */
  description?: string;
  /** Foreign key to PlantingPlan (optional) */
  planting_plan?: number;
  /** Read-only planting plan name */
  planting_plan_name?: string;
  /** Due date (optional) */
  due_date?: string;
  /** Current status of the task */
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  /** Creation timestamp */
  created_at?: string;
  /** Last update timestamp */
  updated_at?: string;
}

/**
 * Paginated API response wrapper
 * @template T The type of items in the results array
 */
export interface PaginatedResponse<T> {
  /** Total count of items */
  count: number;
  /** URL to next page (if any) */
  next: string | null;
  /** URL to previous page (if any) */
  previous: string | null;
  /** Array of items for current page */
  results: T[];
}

// API functions

/**
 * API endpoints for Culture operations
 */
export const cultureAPI = {
  /** Get paginated list of all cultures */
  list: () => api.get<PaginatedResponse<Culture>>('/cultures/'),
  /** Get a specific culture by ID */
  get: (id: number) => api.get<Culture>(`/cultures/${id}/`),
  /** Create a new culture */
  create: (data: Culture) => api.post<Culture>('/cultures/', data),
  /** Update an existing culture */
  update: (id: number, data: Culture) => api.put<Culture>(`/cultures/${id}/`, data),
  /** Delete a culture */
  delete: (id: number) => api.delete(`/cultures/${id}/`),
};

/**
 * API endpoints for Bed operations
 */
export const bedAPI = {
  /** Get paginated list of all beds */
  list: () => api.get<PaginatedResponse<Bed>>('/beds/'),
  /** Get a specific bed by ID */
  get: (id: number) => api.get<Bed>(`/beds/${id}/`),
  /** Create a new bed */
  create: (data: Bed) => api.post<Bed>('/beds/', data),
  /** Update an existing bed */
  update: (id: number, data: Bed) => api.put<Bed>(`/beds/${id}/`, data),
  /** Delete a bed */
  delete: (id: number) => api.delete(`/beds/${id}/`),
};

/**
 * API endpoints for PlantingPlan operations
 */
export const plantingPlanAPI = {
  /** Get paginated list of all planting plans */
  list: () => api.get<PaginatedResponse<PlantingPlan>>('/planting-plans/'),
  /** Get a specific planting plan by ID */
  get: (id: number) => api.get<PlantingPlan>(`/planting-plans/${id}/`),
  /** Create a new planting plan (harvest_date auto-calculated) */
  create: (data: PlantingPlan) => api.post<PlantingPlan>('/planting-plans/', data),
  /** Update an existing planting plan */
  update: (id: number, data: PlantingPlan) => api.put<PlantingPlan>(`/planting-plans/${id}/`, data),
  /** Delete a planting plan */
  delete: (id: number) => api.delete(`/planting-plans/${id}/`),
};

/**
 * API endpoints for Field operations
 */
export const fieldAPI = {
  /** Get paginated list of all fields */
  list: () => api.get<PaginatedResponse<Field>>('/fields/'),
  /** Get a specific field by ID */
  get: (id: number) => api.get<Field>(`/fields/${id}/`),
  /** Create a new field */
  create: (data: Field) => api.post<Field>('/fields/', data),
  /** Update an existing field */
  update: (id: number, data: Field) => api.put<Field>(`/fields/${id}/`, data),
  /** Delete a field */
  delete: (id: number) => api.delete(`/fields/${id}/`),
};

/**
 * API endpoints for Location operations
 */
export const locationAPI = {
  /** Get paginated list of all locations */
  list: () => api.get<PaginatedResponse<Location>>('/locations/'),
  /** Get a specific location by ID */
  get: (id: number) => api.get<Location>(`/locations/${id}/`),
  /** Create a new location */
  create: (data: Location) => api.post<Location>('/locations/', data),
  /** Update an existing location */
  update: (id: number, data: Location) => api.put<Location>(`/locations/${id}/`, data),
  /** Delete a location */
  delete: (id: number) => api.delete(`/locations/${id}/`),
};

/**
 * API endpoints for Task operations
 */
export const taskAPI = {
  /** Get paginated list of all tasks */
  list: () => api.get<PaginatedResponse<Task>>('/tasks/'),
  /** Get a specific task by ID */
  get: (id: number) => api.get<Task>(`/tasks/${id}/`),
  /** Create a new task */
  create: (data: Task) => api.post<Task>('/tasks/', data),
  /** Update an existing task */
  update: (id: number, data: Task) => api.put<Task>(`/tasks/${id}/`, data),
  /** Delete a task */
  delete: (id: number) => api.delete(`/tasks/${id}/`),
};

export default api;
