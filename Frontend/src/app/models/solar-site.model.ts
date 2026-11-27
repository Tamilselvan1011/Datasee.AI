export interface WeightConfig {
  solar: number;
  area: number;
  grid: number;
  slope: number;
  infrastructure: number;
}

export interface ScoreBreakdown {
  solar: number;
  area: number;
  grid: number;
  slope: number;
  infrastructure: number;
}

export interface SolarSite {
  site_id: number;
  site_name: string;
  latitude: number;
  longitude: number;
  area_sqm: number;
  area_acres: number;
  estimated_capacity_mw: number;
  solar_irradiance_kwh: number;
  grid_distance_km: number;
  slope_degrees: number;
  road_distance_km: number;
  elevation_m: number;
  land_type: string;
  region: string;
  solar_irradiance_score: number;
  area_score: number;
  grid_distance_score: number;
  slope_score: number;
  infrastructure_score: number;
  total_suitability_score: number;
  category: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';
  recommendation: string;
  color: string;
  rank: number;
  total_sites_ranked?: number;
  score_breakdown?: ScoreBreakdown;
  weighted_contributions?: ScoreBreakdown;
  weights_used?: WeightConfig;
  analysis_timestamp: string | null;
}

export interface SiteListResponse {
  count: number;
  limit: number;
  offset: number;
  available_regions: string[];
  available_land_types: string[];
  weights_used: WeightConfig;
  results: SolarSite[];
}

export interface AnalyzeResponse {
  persisted: boolean;
  weights_used: WeightConfig;
  total_sites: number;
  average_score: number;
  results: SolarSite[];
}

export interface PolygonAnalyzeResponse {
  matched_count: number;
  average_score: number;
  total_area_sqm: number;
  total_potential_mw: number;
  results: SolarSite[];
}

export interface ScoreBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  color: string;
}

export interface LandTypeStat {
  land_type: string;
  site_count: number;
  avg_score: number;
  max_score: number;
  total_potential_mw: number;
}

export interface RegionStat {
  region: string;
  site_count: number;
  avg_score: number;
  max_score: number;
  total_potential_mw: number;
}

export interface StatisticsResponse {
  total_sites: number;
  avg_score: number;
  min_score: number;
  max_score: number;
  std_dev: number;
  total_area_sqm: number;
  total_potential_mw: number;
  weights_used: WeightConfig;
  score_distribution: ScoreBucket[];
  by_land_type: LandTypeStat[];
  by_region: RegionStat[];
  top_10_sites: SolarSite[];
}

export interface HealthResponse {
  status: string;
  database: string;
  sites_count: number;
}

export interface CsvPreviewRow {
  row_number: number;
  action: 'create' | 'update';
  site_id: number | null;
  site_name: string;
  latitude: number;
  longitude: number;
  area_sqm: number;
  estimated_capacity_mw: number;
  solar_irradiance_kwh: number;
  grid_distance_km: number;
  slope_degrees: number;
  road_distance_km: number;
  elevation_m: number;
  land_type: string;
  region: string;
  total_suitability_score: number;
  category: string;
  color: string;
}

export interface UploadResponse {
  message: string;
  preview?: boolean;
  processed: number;
  created: number;
  updated: number;
  rows?: CsvPreviewRow[];
}

export interface SiteFilters {
  min_score: number | null;
  max_score: number | null;
  region: string;
  land_type: string;
  search: string;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

export interface SitePayload {
  site_name: string;
  latitude: number;
  longitude: number;
  area_sqm: number;
  solar_irradiance_kwh: number;
  grid_distance_km: number;
  slope_degrees: number;
  road_distance_km: number;
  elevation_m: number;
  land_type: string;
  region: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}
