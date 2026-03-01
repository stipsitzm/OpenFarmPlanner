export interface SeedPackage {
  id?: number;
  culture?: number;
  size_value: number;
  size_unit: 'g';
  available: boolean;
  article_number?: string;
  source_url?: string;
  evidence_text?: string;
  last_seen_at?: string | null;
}

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
  package_size_g?: number; // deprecated, replaced by seed_packages
  seeding_requirement?: number;
  seeding_requirement_type?: 'per_sqm' | 'per_plant' | '';
  seed_packages?: SeedPackage[];
  seed_rate_value?: number | null;
  seed_rate_unit?: SeedRateUnit | null;
  id?: number;
  name: string;
  variety?: string;
  seed_supplier?: string;
  supplier?: Supplier | null;
  image_file?: MediaFileRef | null;
  image_file_id?: number | null;
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
  seed_packages?: Array<{ size_value: number; size_unit: 'g'; available: boolean }>;
  package_suggestion?: {
    selection: Array<{ size_value: number; size_unit: 'g'; count: number }>;
    total_amount: number;
    overage: number;
    pack_count: number;
  } | null;
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



export interface RemainingAreaResponse {
  bed_id: number;
  bed_area_sqm: number;
  overlapping_used_area_sqm: number;
  remaining_area_sqm: number;
  start_date: string;
  end_date: string;
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


export interface MediaFileRef {
  id: number;
  storage_path: string;
  uploaded_at?: string;
}

export interface CultureHistoryEntry {
  history_id: number;
  culture_id?: number;
  history_date: string;
  history_type: string;
  history_user: string | null;
  summary: string;
}

export interface EnrichmentUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface EnrichmentCostEstimate {
  currency: 'USD';
  total: number;
  model: string;
  breakdown: {
    input: number;
    cached_input: number;
    output: number;
    web_search_calls: number;
    web_search_call_count: number;
  };
}

export interface EnrichmentFieldSuggestion {
  value: unknown;
  unit: string | null;
  confidence: number;
}

export interface EnrichmentEvidenceEntry {
  source_url: string;
  title: string;
  retrieved_at: string;
  snippet?: string;
}

export interface EnrichmentValidationItem {
  field: string;
  code: string;
  message: string;
}

export interface EnrichmentResult {
  run_id: string;
  culture_id: number;
  mode: 'complete' | 'reresearch';
  status: string;
  started_at: string;
  finished_at: string;
  model: string;
  provider: string;
  search_provider: string;
  suggested_fields: Record<string, EnrichmentFieldSuggestion>;
  evidence: Record<string, EnrichmentEvidenceEntry[]>;
  structured_sources?: Array<{
    title: string;
    url: string;
    type: 'variety_specific' | 'general_crop';
    retrieved_at: string;
    claim_summary: string;
  }>;
  validation: {
    warnings: EnrichmentValidationItem[];
    errors: EnrichmentValidationItem[];
  };
  usage: EnrichmentUsage;
  costEstimate: EnrichmentCostEstimate;
}

export interface EnrichmentBatchItem {
  culture_id: number;
  status: 'completed' | 'failed';
  result?: EnrichmentResult;
  error?: string;
}

export interface EnrichmentBatchResult {
  run_id: string;
  status: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  items: EnrichmentBatchItem[];
  usage: EnrichmentUsage;
  costEstimate: EnrichmentCostEstimate;
}
