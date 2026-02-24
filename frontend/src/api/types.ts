export interface Supplier {
  id?: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  created?: boolean;
}

export type SeedRateUnit = 'g_per_m2' | 'seeds/m' | 'seeds_per_plant';

export interface Culture {
  thousand_kernel_weight_g?: number;
  package_size_g?: number;
  seeding_requirement?: number;
  seeding_requirement_type?: 'per_sqm' | 'per_plant' | '';
  seed_rate_value?: number | null;
  seed_rate_unit?: SeedRateUnit | null;
  id?: number;
  name: string;
  variety?: string;
  seed_supplier?: string;
  supplier?: Supplier | null;
  notes?: string;
  
  crop_family?: string;
  nutrient_demand?: 'low' | 'medium' | 'high' | '';
  cultivation_type?: 'pre_cultivation' | 'direct_sowing' | '';
  
  growth_duration_days?: number;
  harvest_duration_days?: number;
  propagation_duration_days?: number;
  
  harvest_method?: 'per_plant' | 'per_sqm' | '';
  expected_yield?: number;
  allow_deviation_delivery_weeks?: boolean;
  
  distance_within_row_cm?: number;
  row_spacing_cm?: number;
  sowing_depth_cm?: number;

  sowing_calculation_safety_percent?: number;
  
  display_color?: string;
  
  // Computed, read-only.
  plants_per_m2?: number | null;
  
  created_at?: string;
  updated_at?: string;
}


export interface SeedDemand {
  culture_id: number;
  culture_name: string;
  variety?: string | null;
  supplier?: string | null;
  total_grams: number | null;
  package_size_g: number | null;
  packages_needed: number | null;
  warning: string | null;
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
  area_sqm?: number;
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
  // Read-only, computed.
  harvest_date?: string;
  // Read-only, computed.
  harvest_end_date?: string;
  quantity?: number;
  area_usage_sqm?: number;
  // Write-only input used on create/update.
  area_input_value?: number;
  // Write-only input used on create/update.
  area_input_unit?: 'M2' | 'PLANTS';
  notes?: string;
  note_attachment_count?: number;
  created_at?: string;
  updated_at?: string;
}


export interface YieldCalendarCulture {
  culture_id: number;
  culture_name: string;
  color: string;
  yield: number;
}

export interface YieldCalendarWeek {
  iso_week: string;
  week_start: string;
  week_end: string;
  cultures: YieldCalendarCulture[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}


export interface NoteAttachment {
  id: number;
  planting_plan: number;
  image: string;
  image_url?: string;
  caption?: string;
  created_at: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  mime_type?: string;
}
