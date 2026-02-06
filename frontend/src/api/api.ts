/**
 * API client for the OpenFarmPlanner backend.
 * 
 * This module provides typed API functions for interacting with the Django REST API.
 * All API calls use axios and return promises with typed responses.
 */

import http from './httpClient';
import type {
  Culture,
  Location,
  Field,
  Bed,
  PlantingPlan,
  PaginatedResponse,
  Supplier,
} from './types';

// API functions

/**
 * API endpoints for Culture operations
 */
export const cultureAPI = {
  /** Get paginated list of all cultures */
  list: () => http.get<PaginatedResponse<Culture>>('/cultures/'),
  /** Get a specific culture by ID */
  get: (id: number) => http.get<Culture>(`/cultures/${id}/`),
  /** Create a new culture */
  create: (data: Culture) => http.post<Culture>('/cultures/', data),
  /** Update an existing culture */
  update: (id: number, data: Culture) => http.put<Culture>(`/cultures/${id}/`, data),
  /** Delete a culture */
  delete: (id: number) => http.delete(`/cultures/${id}/`),
  /** Import multiple cultures from JSON data */
  import: (data: Record<string, unknown>[]) => http.post('/cultures/import/', data),
};

/**
 * API endpoints for Supplier operations
 */
export const supplierAPI = {
  /** Get list of suppliers, optionally filtered by query */
  list: (query?: string) => {
    const params = query ? { q: query } : {};
    return http.get<PaginatedResponse<Supplier>>('/suppliers/', { params });
  },
  /** Get a specific supplier by ID */
  get: (id: number) => http.get<Supplier>(`/suppliers/${id}/`),
  /** Create or get existing supplier by name (get-or-create) */
  create: (name: string) => http.post<Supplier>('/suppliers/', { name }),
  /** Update an existing supplier */
  update: (id: number, data: Supplier) => http.put<Supplier>(`/suppliers/${id}/`, data),
  /** Delete a supplier */
  delete: (id: number) => http.delete(`/suppliers/${id}/`),
};

/**
 * API endpoints for Bed operations
 */
export const bedAPI = {
  /** Get paginated list of all beds */
  list: () => http.get<PaginatedResponse<Bed>>('/beds/'),
  /** Get a specific bed by ID */
  get: (id: number) => http.get<Bed>(`/beds/${id}/`),
  /** Create a new bed */
  create: (data: Bed) => http.post<Bed>('/beds/', data),
  /** Update an existing bed */
  update: (id: number, data: Bed) => http.put<Bed>(`/beds/${id}/`, data),
  /** Delete a bed */
  delete: (id: number) => http.delete(`/beds/${id}/`),
};

/**
 * API endpoints for PlantingPlan operations
 */
export const plantingPlanAPI = {
  /** Get paginated list of all planting plans */
  list: () => http.get<PaginatedResponse<PlantingPlan>>('/planting-plans/'),
  /** Get a specific planting plan by ID */
  get: (id: number) => http.get<PlantingPlan>(`/planting-plans/${id}/`),
  /** Create a new planting plan (harvest_date auto-calculated) */
  create: (data: PlantingPlan) => http.post<PlantingPlan>('/planting-plans/', data),
  /** Update an existing planting plan */
  update: (id: number, data: PlantingPlan) => http.put<PlantingPlan>(`/planting-plans/${id}/`, data),
  /** Delete a planting plan */
  delete: (id: number) => http.delete(`/planting-plans/${id}/`),
};

/**
 * API endpoints for Field operations
 */
export const fieldAPI = {
  /** Get paginated list of all fields */
  list: () => http.get<PaginatedResponse<Field>>('/fields/'),
  /** Get a specific field by ID */
  get: (id: number) => http.get<Field>(`/fields/${id}/`),
  /** Create a new field */
  create: (data: Field) => http.post<Field>('/fields/', data),
  /** Update an existing field */
  update: (id: number, data: Field) => http.put<Field>(`/fields/${id}/`, data),
  /** Delete a field */
  delete: (id: number) => http.delete(`/fields/${id}/`),
};

/**
 * API endpoints for Location operations
 */
export const locationAPI = {
  /** Get paginated list of all locations */
  list: () => http.get<PaginatedResponse<Location>>('/locations/'),
  /** Get a specific location by ID */
  get: (id: number) => http.get<Location>(`/locations/${id}/`),
  /** Create a new location */
  create: (data: Location) => http.post<Location>('/locations/', data),
  /** Update an existing location */
  update: (id: number, data: Location) => http.put<Location>(`/locations/${id}/`, data),
  /** Delete a location */
  delete: (id: number) => http.delete(`/locations/${id}/`),
};

// Re-export types for convenience
export type {
  Culture,
  Location,
  Field,
  Bed,
  PlantingPlan,
  PaginatedResponse,
  Supplier,
};

// Default export: object bundling all API endpoints
export default {
  cultures: cultureAPI,
  suppliers: supplierAPI,
  beds: bedAPI,
  plantingPlans: plantingPlanAPI,
  fields: fieldAPI,
  locations: locationAPI,
};
