export type PlanningPolicy =
  | "reorder_point"
  | "min_max"
  | "periodic_review"
  | "make_to_order"
  | "none";

export type ShipmentStatus =
  | "draft"
  | "planned"
  | "loaded"
  | "in_transit"
  | "delivered"
  | "partially_delivered"
  | "failed"
  | "cancelled";

export type TransferStatus =
  | "draft"
  | "approved"
  | "in_transit"
  | "received"
  | "partially_received"
  | "cancelled";

export type ReturnStatus =
  | "draft"
  | "authorised"
  | "received"
  | "inspected"
  | "closed"
  | "rejected";

export interface ProductRef {
  id: number;
  name?: string | null;
  sku?: string | null;
}

export interface PlanningProfile {
  id: number;
  product_id: number;
  warehouse_id?: number | null;
  policy: PlanningPolicy;
  safety_stock: number | string;
  reorder_point: number | string;
  reorder_quantity: number | string;
  maximum_level?: number | string | null;
  minimum_order_quantity: number | string;
  order_multiple?: number | string | null;
  lead_time_days: number;
  review_period_days: number;
  average_daily_demand: number | string;
  lead_time_demand: number;
  abc_class?: string | null;
  preferred_supplier_id?: number | null;
  is_active: boolean;
  notes?: string | null;
  product?: ProductRef | null;
}

export interface DemandForecast {
  id: number;
  product_id: number;
  warehouse_id?: number | null;
  period_start: string;
  period_end: string;
  forecast_quantity: number | string;
  actual_quantity?: number | string | null;
  accuracy_percent?: number | null;
  source: "manual" | "historical" | "production_plan" | "contract";
  confidence_percent?: number | string | null;
  notes?: string | null;
  product?: ProductRef | null;
}

export interface ReplenishmentSuggestion {
  id: number;
  product_id: number;
  warehouse_id?: number | null;
  on_hand: number | string;
  on_order: number | string;
  in_transit: number | string;
  allocated: number | string;
  forecast_demand: number | string;
  projected_position: number | string;
  reorder_point: number | string;
  suggested_quantity: number | string;
  days_of_cover?: number | string | null;
  urgency: "critical" | "high" | "normal";
  reason?: string | null;
  status: "open" | "actioned" | "dismissed" | "expired";
  preferred_supplier_id?: number | null;
  converted_reference?: string | null;
  generated_at: string;
  product?: ProductRef | null;
}

export interface StockPosition {
  on_hand: number;
  on_order: number;
  in_transit: number;
  allocated: number;
  forecast_demand: number;
  projected_position: number;
}

export interface DeliveryRoute {
  id: number;
  name: string;
  code: string;
  area?: string | null;
  service_days?: string[] | null;
  default_vehicle?: string | null;
  planned_distance_km?: number | string | null;
  planned_duration_minutes?: number | null;
  capacity_units?: number | null;
  is_active: boolean;
  notes?: string | null;
}

export interface ShipmentItem {
  id: number;
  shipment_id: number;
  product_id: number;
  quantity: number | string;
  delivered_quantity: number | string;
  shortfall_quantity: number;
  uom: string;
  unit_price?: number | string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  product?: ProductRef | null;
}

export interface Shipment {
  id: number;
  shipment_number: string;
  delivery_note_number?: string | null;
  customer_contact_id?: number | null;
  route_id?: number | null;
  origin_warehouse_id?: number | null;
  origin_location_id?: number | null;
  status: ShipmentStatus;
  priority: string;
  vehicle?: string | null;
  driver_id?: number | null;
  planned_dispatch_at?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  destination_name?: string | null;
  destination_address?: string | null;
  destination_phone?: string | null;
  received_by_name?: string | null;
  proof_reference?: string | null;
  failure_reason?: string | null;
  total_quantity: number | string;
  total_value: number | string;
  fill_rate_percent: number;
  is_on_time?: boolean | null;
  notes?: string | null;
  items?: ShipmentItem[];
  route?: DeliveryRoute | null;
}

export interface TransferOrderItem {
  id: number;
  product_id: number;
  quantity: number | string;
  dispatched_quantity: number | string;
  received_quantity: number | string;
  variance_quantity: number;
  uom: string;
  batch_number?: string | null;
  product?: ProductRef | null;
}

export interface TransferOrder {
  id: number;
  transfer_number: string;
  from_warehouse_id: number;
  to_warehouse_id: number;
  from_location_id?: number | null;
  to_location_id?: number | null;
  status: TransferStatus;
  requested_at?: string | null;
  dispatched_at?: string | null;
  received_at?: string | null;
  vehicle?: string | null;
  reason?: string | null;
  in_transit_quantity: number;
  items?: TransferOrderItem[];
}

export interface ReturnItem {
  id: number;
  product_id: number;
  quantity: number | string;
  accepted_quantity: number | string;
  uom: string;
  batch_number?: string | null;
  condition?: string | null;
  unit_price?: number | string | null;
  product?: ProductRef | null;
}

export interface SupplyChainReturn {
  id: number;
  return_number: string;
  customer_contact_id?: number | null;
  shipment_id?: number | null;
  reason: string;
  status: ReturnStatus;
  disposition?: string | null;
  requested_at?: string | null;
  received_at?: string | null;
  return_location_id?: number | null;
  total_quantity: number | string;
  credit_amount: number | string;
  inspection_notes?: string | null;
  items?: ReturnItem[];
  shipment?: Shipment | null;
}

export interface LandedCostLine {
  id: number;
  product_id: number;
  quantity: number | string;
  weight_kg?: number | string | null;
  unit_price_foreign: number | string;
  line_value_foreign: number | string;
  line_value_base: number | string;
  allocated_overhead: number | string;
  landed_unit_cost: number | string;
  landed_line_total: number | string;
  uplift_percent: number;
  product?: ProductRef | null;
}

export interface LandedCost {
  id: number;
  reference: string;
  purchase_order_id?: number | null;
  supplier_id?: number | null;
  currency: string;
  exchange_rate: number | string;
  goods_value: number | string;
  freight_cost: number | string;
  insurance_cost: number | string;
  customs_duty: number | string;
  excise_tax: number | string;
  port_handling_cost: number | string;
  inland_transport_cost: number | string;
  bank_charges: number | string;
  other_costs: number | string;
  goods_value_base: number | string;
  total_landed_cost: number | string;
  overhead_total: number;
  overhead_percent: number;
  allocation_basis: "value" | "quantity" | "weight";
  status: "draft" | "allocated" | "posted";
  cleared_on?: string | null;
  declaration_number?: string | null;
  lines?: LandedCostLine[];
}

export interface SupplyChainOverview {
  period: { from: string; to: string };
  targets: { otif: number; fill_rate: number; return_rate: number };
  service: {
    shipments_total: number;
    shipments_completed: number;
    shipments_in_flight: number;
    shipments_failed: number;
    fill_rate_percent: number;
    otif_percent: number;
    units_delivered: number;
    delivered_value: number;
  };
  replenishment: {
    open_suggestions: number;
    critical: number;
    high: number;
    suggested_units: number;
    profiles_active: number;
    stockout_risk: number;
    top_shortages: Array<{
      product_id: number;
      warehouse_id: number | null;
      projected_position: number;
      /** Gap below the reorder point — always positive, so bars rank correctly. */
      shortfall: number;
      suggested_quantity: number;
      urgency: string;
      days_of_cover: number | null;
    }>;
  };
  transfers: {
    in_transit_orders: number;
    in_transit_units: number;
    awaiting_approval: number;
  };
  returns: {
    total: number;
    open: number;
    units_returned: number;
    credit_value: number;
    by_reason: Array<{ reason: string; count: number; units: number }>;
  };
  landed_cost: {
    consignments: number;
    goods_value_base: number;
    overhead_total: number;
    total_landed_cost: number;
    average_overhead_percent: number;
  };
  route_performance: Array<{
    route_id: number | null;
    route_name: string;
    shipments: number;
    fill_rate_percent: number;
    on_time_percent: number;
    units_delivered: number;
  }>;
  daily_service: Array<{
    date: string;
    shipments: number;
    ordered_units: number;
    delivered_units: number;
    fill_rate_percent: number;
    otif_percent: number;
  }>;
  shipment_status_mix: Array<{ status: string; count: number; units: number }>;
  cover_distribution: Array<{
    key: string;
    label: string;
    severity: string;
    count: number;
  }>;
  landed_cost_breakdown: Array<{
    component: string;
    label: string;
    amount: number;
    share_percent: number;
  }>;
}
