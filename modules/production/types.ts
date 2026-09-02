export type ProductionOrderStatus =
  | "draft"
  | "scheduled"
  | "released"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type ProductionQaStatus =
  | "pending"
  | "in_test"
  | "released"
  | "quarantined"
  | "rejected";

export interface ProductionLine {
  id: number;
  tenant_id: string;
  name: string;
  code: string;
  line_type: string;
  rated_speed_bph: number | string;
  supported_formats?: string[] | null;
  output_warehouse_id?: number | null;
  component_warehouse_id?: number | null;
  commissioned_on?: string | null;
  is_active: boolean;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionBomItem {
  id: number;
  bom_id: number;
  component_product_id: number;
  component_type: string;
  quantity_per_unit: number | string;
  uom: string;
  scrap_percent: number | string;
  is_critical: boolean;
  notes?: string | null;
  component?: { id: number; name?: string | null } | null;
}

export interface ProductionBom {
  id: number;
  tenant_id: string;
  product_id: number;
  name: string;
  code: string;
  version: number;
  status: "draft" | "active" | "archived";
  pack_size_ml: number | string;
  units_per_pack: number;
  water_litres_per_unit: number | string;
  expected_yield_percent: number | string;
  shelf_life_days?: number | null;
  effective_from?: string | null;
  notes?: string | null;
  items?: ProductionBomItem[];
  product?: { id: number; name?: string | null } | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionMaterialConsumption {
  id: number;
  production_order_id: number;
  component_product_id: number;
  component_type: string;
  planned_quantity: number | string;
  actual_quantity: number | string;
  variance_quantity: number;
  uom: string;
  unit_cost?: number | string | null;
  supplier_batch_number?: string | null;
  consumed_at?: string | null;
  component?: { id: number; name?: string | null } | null;
}

export interface ProductionOrder {
  id: number;
  tenant_id: string;
  order_number: string;
  batch_number: string;
  product_id: number;
  bom_id?: number | null;
  production_line_id?: number | null;
  planned_quantity: number | string;
  produced_quantity: number | string;
  rejected_quantity: number | string;
  yield_percent: number;
  uom: string;
  status: ProductionOrderStatus;
  priority: "low" | "normal" | "high" | "urgent";
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  manufactured_on?: string | null;
  expires_on?: string | null;
  qa_status: ProductionQaStatus;
  qa_decided_at?: string | null;
  qa_notes?: string | null;
  output_warehouse_id?: number | null;
  output_location_id?: number | null;
  notes?: string | null;
  product?: { id: number; name?: string | null } | null;
  line?: ProductionLine | null;
  bom?: ProductionBom | null;
  consumptions?: ProductionMaterialConsumption[];
  runs?: ProductionRun[];
  treatmentLogs?: WaterTreatmentLog[];
  sanitationLogs?: SanitationLog[];
  created_at: string;
  updated_at: string;
}

export interface ProductionDowntimeEvent {
  id: number;
  production_run_id?: number | null;
  production_line_id?: number | null;
  reason_code: string;
  reason_label: string;
  category: "planned" | "unplanned";
  started_at: string;
  ended_at?: string | null;
  duration_minutes: number | string;
  notes?: string | null;
  line?: ProductionLine | null;
  run?: { id: number; order?: ProductionOrder | null } | null;
}

export interface ProductionRun {
  id: number;
  production_order_id: number;
  production_line_id?: number | null;
  shift: string;
  supervisor_id?: number | null;
  started_at: string;
  ended_at?: string | null;
  planned_runtime_minutes: number;
  good_units: number | string;
  reject_units: number | string;
  reject_breakdown?: Record<string, number> | null;
  ideal_speed_bph?: number | string | null;
  water_consumed_litres: number | string;
  power_outage_minutes: number | string;
  notes?: string | null;
  order?: ProductionOrder | null;
  line?: ProductionLine | null;
  supervisor?: { id: number; name?: string | null } | null;
  downtime_events?: ProductionDowntimeEvent[];
}

export interface WaterTreatmentLog {
  id: number;
  production_order_id?: number | null;
  production_line_id?: number | null;
  logged_at: string;
  source_type: string;
  source_reference?: string | null;
  raw_turbidity_ntu?: number | string | null;
  post_carbon_chlorine_ppm?: number | string | null;
  post_softener_hardness_ppm?: number | string | null;
  treated_ph?: number | string | null;
  treated_tds_ppm?: number | string | null;
  treated_conductivity_us?: number | string | null;
  uv_intensity_mw_cm2?: number | string | null;
  ozone_residual_ppm?: number | string | null;
  treated_temperature_c?: number | string | null;
  backwash_performed: boolean;
  filters_changed: boolean;
  status: "pass" | "warning" | "fail";
  breaches?: WaterTreatmentBreach[] | null;
  corrective_action?: string | null;
  line?: ProductionLine | null;
}

export interface WaterTreatmentBreach {
  field: string;
  label: string;
  stage: string;
  value: number;
  unit: string;
  min: number | null;
  max: number | null;
  direction: "below_minimum" | "above_maximum";
  is_critical: boolean;
}

export interface WaterTreatmentParameter {
  field: string;
  stage: string;
  label: string;
  unit: string;
  min: number | null;
  max: number | null;
  is_critical: boolean;
  description: string;
}

export interface SanitationLog {
  id: number;
  production_line_id?: number | null;
  production_order_id?: number | null;
  cip_type: string;
  started_at: string;
  ended_at?: string | null;
  chemical?: string | null;
  concentration_percent?: number | string | null;
  temperature_c?: number | string | null;
  contact_minutes?: number | null;
  final_rinse_result: "pending" | "pass" | "fail";
  final_rinse_conductivity_us?: number | string | null;
  verified_at?: string | null;
  notes?: string | null;
  line?: ProductionLine | null;
  performed_by?: { id: number; name?: string | null } | null;
  verified_by?: { id: number; name?: string | null } | null;
}

export interface DowntimeReason {
  code: string;
  label: string;
  category: "planned" | "unplanned";
  group: string;
}

export interface OeeMetrics {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  planned_minutes: number;
  operating_minutes: number;
  downtime_minutes: number;
  good_units: number;
  reject_units: number;
  total_units: number;
}

export interface ContainerType {
  id: number;
  tenant_id: string;
  name: string;
  code: string;
  capacity_litres: number | string;
  deposit_amount: number | string;
  product_id?: number | null;
  expected_trips?: number | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContainerMovement {
  id: number;
  container_type_id: number;
  customer_contact_id?: number | null;
  production_order_id?: number | null;
  movement_type: "issue" | "return" | "scrap" | "adjustment";
  quantity: number | string;
  deposit_per_unit: number | string;
  deposit_amount: number | string;
  deposit_forfeited: boolean;
  condition?: string | null;
  reference?: string | null;
  occurred_at: string;
  notes?: string | null;
  container_type?: ContainerType | null;
}

export interface ContainerBalance {
  id: number;
  container_type_id: number;
  customer_contact_id?: number | null;
  containers_out: number | string;
  deposit_held: number | string;
  lifetime_issued: number | string;
  lifetime_returned: number | string;
  lifetime_scrapped: number | string;
  return_rate_percent: number;
  last_movement_at?: string | null;
  container_type?: ContainerType | null;
}

export interface ContainerFleetSummary {
  total_containers_out: number;
  total_deposit_held: number;
  by_type: Array<{
    container_type_id: number;
    name: string;
    code: string | null;
    capacity_litres: number;
    containers_out: number;
    deposit_held: number;
    lifetime_issued: number;
    lifetime_returned: number;
    lifetime_scrapped: number;
    return_rate_percent: number;
  }>;
}

export interface ProductionOverview {
  period: { from: string; to: string };
  oee: OeeMetrics;
  targets: { availability: number; performance: number; quality: number; overall: number };
  orders: {
    total: number;
    open: number;
    completed: number;
    awaiting_qa: number;
    quarantined: number;
    planned_quantity: number;
    produced_quantity: number;
  };
  downtime_pareto: Array<{
    reason_code: string;
    label: string;
    category: string;
    occurrences: number;
    minutes: number;
    share_percent: number;
  }>;
  reject_pareto: Array<{
    defect_code: string;
    label: string;
    units: number;
    share_percent: number;
  }>;
  line_performance: Array<OeeMetrics & {
    production_line_id: number | null;
    line_name: string;
    runs: number;
  }>;
  daily_output: Array<{
    date: string;
    good_units: number;
    reject_units: number;
    downtime_minutes: number;
  }>;
  water_treatment: {
    logs: number;
    passed: number;
    warnings: number;
    failed: number;
    compliance_percent: number;
    average_ph: number | null;
    average_tds_ppm: number | null;
  };
  containers: ContainerFleetSummary;
}

export interface BatchTrace {
  batch_number: string;
  order: {
    id: number;
    order_number: string;
    status: ProductionOrderStatus;
    qa_status: ProductionQaStatus;
    qa_notes?: string | null;
    qa_decided_at?: string | null;
    qa_decided_by?: string | null;
    planned_quantity: number;
    produced_quantity: number;
    rejected_quantity: number;
    yield_percent: number;
    manufactured_on?: string | null;
    expires_on?: string | null;
    created_by?: string | null;
  };
  product: { id: number; name?: string | null; sku?: string | null };
  line: { id: number; name: string; code: string; line_type: string } | null;
  bom: { id: number; code: string; version: number; pack_size_ml: number } | null;
  runs: Array<{
    id: number;
    shift: string;
    supervisor?: string | null;
    started_at: string;
    ended_at?: string | null;
    good_units: number;
    reject_units: number;
    reject_breakdown?: Record<string, number> | null;
    downtime_minutes: number;
    downtime_events: Array<{
      reason_code: string;
      label: string;
      category: string;
      duration_minutes: number;
      started_at: string;
    }>;
  }>;
  materials: Array<{
    component_product_id: number;
    component_name?: string | null;
    component_type: string;
    supplier_batch_number?: string | null;
    planned_quantity: number;
    actual_quantity: number;
    variance_quantity: number;
    uom: string;
    consumed_at?: string | null;
  }>;
  water_treatment: Array<{
    logged_at: string;
    source_type: string;
    source_reference?: string | null;
    treated_ph?: number | string | null;
    treated_tds_ppm?: number | string | null;
    ozone_residual_ppm?: number | string | null;
    uv_intensity_mw_cm2?: number | string | null;
    status: string;
    breaches?: WaterTreatmentBreach[] | null;
    corrective_action?: string | null;
    logged_by?: string | null;
  }>;
  sanitation: Array<{
    cip_type: string;
    started_at: string;
    ended_at?: string | null;
    chemical?: string | null;
    concentration_percent?: number | string | null;
    temperature_c?: number | string | null;
    contact_minutes?: number | null;
    final_rinse_result: string;
    performed_by?: string | null;
  }>;
  release_tests: Array<{
    result?: string | null;
    notes?: string | null;
    tested_at?: string | null;
    tested_by?: string | null;
    payload?: Record<string, unknown> | null;
  }>;
  stock_movements: Array<{
    id: number;
    type: string;
    product_id: number;
    quantity: number;
    batch_number?: string | null;
    from_location?: string | null;
    to_location?: string | null;
    created_at: string;
  }>;
}
