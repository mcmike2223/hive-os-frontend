/**
 * Agriculture types (proposal §5.14).
 *
 * Decimal casts arrive as strings over JSON, so anything numeric is typed
 * `Numeric` and coerced at the render boundary. Several figures are
 * deliberately nullable — a crop still in the ground has no yield achievement,
 * and that is not the same as zero.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type PlantingStatus =
  | "planned"
  | "planted"
  | "growing"
  | "harvesting"
  | "harvested"
  | "failed";

export type ActivityType =
  | "ploughing"
  | "sowing"
  | "irrigation"
  | "fertilising"
  | "spraying"
  | "weeding"
  | "scouting"
  | "other";

export type QualityGrade = "A" | "B" | "C" | "reject";

export type AgricultureField = {
  id: number;
  code: string;
  name: string;
  /** The denominator for every yield figure on this land. */
  area_hectares: Numeric;
  soil_type: string | null;
  irrigation: string | null;
  location: string | null;
  latitude: Numeric;
  longitude: Numeric;
  warehouse_id: number | null;
  is_active: boolean;
  notes: string | null;
  /** Live plantings only — harvested land is free again. */
  planted_hectares?: number;
  utilisation_percent?: number | null;
  /** A mistyped area, surfaced rather than clamped. */
  is_over_planted?: boolean;
  plantings_count?: number;
};

export type AgricultureCrop = {
  id: number;
  code: string;
  name: string;
  variety: string | null;
  category: string | null;
  growth_days: number;
  expected_yield_per_hectare: Numeric;
  unit: string;
  product_id: number | null;
  is_active: boolean;
  notes: string | null;
  plantings_count?: number;
};

export type AgricultureSeason = {
  id: number;
  code: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: "planned" | "active" | "closed";
  notes: string | null;
  plantings_count?: number;
};

export type AgriculturePlanting = {
  id: number;
  reference: string;
  field_id: number;
  crop_id: number;
  season_id: number | null;
  /** The area actually under this crop, not the area of the field. */
  area_hectares: Numeric;
  planted_on: string | null;
  /** Frozen from the crop at planting, so a later change cannot rewrite it. */
  expected_harvest_on: string | null;
  seed_quantity: Numeric;
  seed_unit: string;
  status: PlantingStatus;
  failure_reason: string | null;
  notes: string | null;
  is_live?: boolean;
  /** Null before anything went in the ground. */
  days_since_planting?: number | null;
  days_to_harvest?: number | null;
  is_overdue_for_harvest?: boolean;
  field?: AgricultureField | null;
  crop?: AgricultureCrop | null;
  season?: AgricultureSeason | null;
  /** Attached by the API: summed across every pick. */
  harvested_kg?: number;
  waste_kg?: number;
  yield_per_hectare?: number | null;
  /** Null while still growing — not yet judged, rather than judged badly. */
  yield_achievement_percent?: number | null;
  total_cost?: number;
  /** Null until something has been picked. */
  cost_per_kg?: number | null;
};

export type AgricultureActivity = {
  id: number;
  planting_id: number;
  type: ActivityType;
  performed_on: string;
  description: string | null;
  input_product_id: number | null;
  input_name: string | null;
  input_quantity: Numeric;
  input_unit: string | null;
  labour_hours: Numeric;
  labour_cost: Numeric;
  input_cost: Numeric;
  machinery_cost: Numeric;
  /** Computed from the three costs above, never accepted from a form. */
  total_cost: Numeric;
  performed_by_name: string | null;
};

export type AgricultureHarvest = {
  id: number;
  planting_id: number;
  field_id: number;
  crop: string;
  season: string | null;
  harvested_on: string;
  quantity_kg: Numeric;
  waste_kg: Numeric;
  /** Computed from the planted area on write. */
  yield_per_hectare: Numeric;
  quality_grade: QualityGrade | null;
  moisture_percent: Numeric;
  warehouse_id: number | null;
  received_by_name: string | null;
  notes: string | null;
  gross_kg?: number;
  /** Against the gross picked, never the saleable weight. */
  waste_percent?: number | null;
  planting?: AgriculturePlanting | null;
};

export type LivestockPurpose = "dairy" | "beef" | "layer" | "broiler" | "breeding" | "draught";

export type AgricultureLivestockGroup = {
  id: number;
  code: string;
  name: string;
  species: string;
  breed: string | null;
  purpose: LivestockPurpose;
  head_count: number;
  field_id: number | null;
  is_active: boolean;
  notes: string | null;
  /** Null with no animals — there is no per-head figure for an empty group. */
  production_per_head?: number | null;
  mortality_percent?: number | null;
  records_count?: number;
};

export type OverduePlanting = {
  planting_id: number;
  reference: string;
  field: string | null;
  crop: string | null;
  area_hectares: number;
  expected_harvest_on: string | null;
  days_overdue: number;
  harvested_kg: number;
};

export type AgricultureOverview = {
  range: { from: string | null; to: string | null };
  production: {
    harvested_kg: number;
    waste_kg: number;
    gross_kg: number;
    waste_percent: number;
    harvest_events: number;
    production_cost: number;
    /** Null until something has been picked. */
    cost_per_kg: number | null;
    /** Null when nothing finished can be judged yet. */
    yield_achievement_percent: number | null;
    scored_plantings: number;
    by_grade: Array<{ grade: QualityGrade; label: string; kg: number }>;
  };
  land: {
    fields: number;
    total_hectares: number;
    planted_hectares: number;
    idle_hectares: number;
    utilisation_percent: number;
    /** Fields with more planted than they have — a data error to chase. */
    over_planted: number;
    by_field: Array<{
      field_id: number;
      name: string;
      hectares: number;
      planted_hectares: number;
      utilisation_percent: number | null;
      is_over_planted: boolean;
    }>;
  };
  plantings: {
    total: number;
    live: number;
    harvested: number;
    failed: number;
    overdue: number;
    by_status: Array<{ status: PlantingStatus; label: string; count: number }>;
  };
  crops: Array<{
    crop: string;
    plantings: number;
    area_hectares: number;
    harvested_kg: number;
    /** Weighted by area across the crop, not an average of per-planting yields. */
    yield_per_hectare: number | null;
    expected_yield_per_hectare: number;
    achievement_percent: number | null;
  }>;
  livestock: {
    groups: number;
    head: number;
    by_species: Array<{ species: string; groups: number; head: number }>;
    production: Array<{
      group_id: number;
      name: string;
      species: string;
      purpose: LivestockPurpose;
      head: number;
      per_head: number | null;
      mortality_percent: number | null;
    }>;
  };
  overdue: OverduePlanting[];
  integrations: {
    inventory: boolean;
    warehouse: boolean;
    human_resources: boolean;
    vantage: boolean;
  };
};
