/**
 * Type definitions for the OpenFarmPlanner API.
 * 
 * Contains all interfaces and types used to communicate with the Django REST API.
 */

/**
 * Culture (crop) type that can be grown
 */
export interface Culture {
    /** Saatgutbedarf pro m² oder pro Pflanze (optional) */
    seeding_requirement?: number;
    /** Art des Saatgutbedarfs: pro m² oder pro Pflanze (optional) */
    seeding_requirement_type?: 'per_sqm' | 'per_plant' | '';
  /** Saatgutmenge (Aussaatstärke, optional) */
  seed_rate_value?: number | null;
  /** Einheit der Saatgutmenge (optional) */
  seed_rate_unit?: 'g_per_m2' | 'pcs_per_m2' | 'pcs_per_plant' | null;
  /** Unique identifier (auto-generated) */
  id?: number;
  /** Name of the crop */
  name: string;
  /** Specific variety of the crop (optional) */
  variety?: string;
  /** Seed supplier/manufacturer (optional) */
  seed_supplier?: string;
  /** Average days from planting to harvest */

  /** Additional notes */
  notes?: string;
  
  // Manual planning fields
  /** Crop family for rotation planning (optional) */
  crop_family?: string;
  /** Nutrient demand level (optional) */
  nutrient_demand?: 'low' | 'medium' | 'high' | '';
  /** Type of cultivation (optional) */
  cultivation_type?: 'pre_cultivation' | 'direct_sowing' | '';
  
  // Timing fields (in days)
  /** Growth duration in days (from planting to first harvest, required) */
  growth_duration_days: number;
  /** Harvest duration in days (from first to last harvest, required) */
  harvest_duration_days: number;
  /** Propagation duration in days (optional) */
  propagation_duration_days?: number;
  
  // Harvest information
  /** Harvest method (optional) */
  harvest_method?: 'per_plant' | 'per_sqm' | '';
  /** Expected yield amount (optional) */
  expected_yield?: number;
  /** Allow deviating delivery weeks (optional) */
  allow_deviation_delivery_weeks?: boolean;
  
  // Planting distances (API exposes in cm, stored internally in meters)
  /** Distance within row in cm (optional) */
  distance_within_row_cm?: number;
  /** Row spacing in cm (optional) */
  row_spacing_cm?: number;
  /** Sowing depth in cm (optional) */
  sowing_depth_cm?: number;

  /** Prozentuale Sicherheit für die Berechnung der Aussaat- und Pflanzenmenge (optional, 0-100) */
  sowing_calculation_safety_percent?: number;
  
  // Display settings
  /** Display color for cultivation calendar (hex format, optional) */
  display_color?: string;
  
  // Growstuff API fields (read-only)
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
  /** Area in square meters (optional, stored in SI units) */
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
  /** Area in square meters (optional, stored in SI units) */
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
  /** Area in square meters used by this planting plan (optional, stored in SI units) */
  area_usage_sqm?: number;
  /** Additional notes */
  notes?: string;
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
