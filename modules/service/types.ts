/**
 * Service and maintenance types (proposal §5.10).
 *
 * Decimal casts arrive as strings over JSON, so anything numeric is typed
 * `Numeric` and coerced at the render boundary.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type ContractTier = "bronze" | "standard" | "gold" | "platinum";

export type ServiceContract = {
  id: number;
  contract_number: string;
  name: string;
  crm_account_id: number | null;
  sales_customer_id: number | null;
  customer_name: string;
  tier: ContractTier;
  /** The promise, in hours from when a fault is reported. */
  response_hours: number;
  resolution_hours: number;
  is_24_7: boolean;
  business_day_starts_at: number;
  business_day_ends_at: number;
  starts_on: string;
  ends_on: string | null;
  value: Numeric;
  /** Null means unlimited. */
  included_visits: number | null;
  status: string;
  notes: string | null;
  is_in_force?: boolean;
  /** Negative once expired, which makes a renewals list sortable. */
  days_to_expiry?: number | null;
  assets_count?: number;
  requests_count?: number;
};

export type AssetStatus = "operational" | "faulty" | "decommissioned";

/** Who pays for work on this asset today. */
export type Coverage = "warranty" | "contract" | "chargeable";

export type ServiceAsset = {
  id: number;
  asset_tag: string;
  name: string;
  category: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  contract_id: number | null;
  crm_account_id: number | null;
  customer_name: string | null;
  site: string | null;
  installed_on: string | null;
  warranty_expires_on: string | null;
  purchase_value: Numeric;
  status: AssetStatus;
  notes: string | null;
  under_warranty?: boolean;
  coverage?: Coverage;
  requests_count?: number;
  contract?: ServiceContract | null;
  requests?: ServiceRequest[];
  plans?: ServiceMaintenancePlan[];
};

export type ServiceTechnician = {
  id: number;
  employee_id: number | null;
  name: string;
  phone: string | null;
  /** Comma separated competencies. */
  skills: string | null;
  hourly_rate: Numeric;
  status: string;
  work_orders_count?: number;
};

export type AvailableTechnician = {
  technician_id: number;
  name: string;
  skills: string | null;
  open_jobs: number;
  hourly_rate: number;
};

export type RequestStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "on_hold"
  | "resolved"
  | "closed"
  | "cancelled";

export type Priority = "low" | "normal" | "high" | "critical";

export type ServiceRequest = {
  id: number;
  request_number: string;
  asset_id: number | null;
  contract_id: number | null;
  customer_name: string | null;
  subject: string;
  description: string | null;
  priority: Priority;
  channel: string | null;
  status: RequestStatus;
  reported_at: string;
  /** Frozen at intake: a renegotiated SLA must not un-breach past work. */
  response_due_at: string | null;
  resolution_due_at: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  /** Time the clock spent stopped waiting on the customer. */
  paused_minutes: number;
  paused_at: string | null;
  response_breached: boolean;
  resolution_breached: boolean;
  resolution_summary: string | null;
  satisfaction_rating: number | null;
  is_open?: boolean;
  /** Null while unresolved — an in-flight request has no duration yet. */
  resolution_hours_taken?: Numeric;
  asset?: ServiceAsset | null;
  contract?: ServiceContract | null;
  work_orders?: ServiceWorkOrder[];
};

export type WorkOrderStatus = "scheduled" | "dispatched" | "in_progress" | "completed" | "cancelled";

export type WorkOrderType = "corrective" | "preventive" | "installation" | "inspection";

export type ServiceWorkOrderPart = {
  id: number;
  work_order_id: number;
  product_id: number | null;
  description: string;
  quantity: Numeric;
  unit_cost: Numeric;
  line_cost: Numeric;
};

export type ServiceWorkOrder = {
  id: number;
  work_order_number: string;
  request_id: number | null;
  asset_id: number | null;
  technician_id: number | null;
  plan_id: number | null;
  type: WorkOrderType;
  status: WorkOrderStatus;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  labour_hours: Numeric;
  labour_cost: Numeric;
  parts_cost: Numeric;
  total_cost: Numeric;
  is_billable: boolean;
  coverage: Coverage;
  /** Drives the first-time-fix rate. */
  resolved_the_fault: boolean;
  work_performed: string | null;
  is_overdue?: boolean;
  asset?: ServiceAsset | null;
  technician?: ServiceTechnician | null;
  request?: ServiceRequest | null;
  parts?: ServiceWorkOrderPart[];
};

export type ServiceMaintenancePlan = {
  id: number;
  asset_id: number;
  name: string;
  interval_days: number;
  last_serviced_on: string | null;
  estimated_hours: number;
  is_active: boolean;
  next_due_on?: string | null;
  /** Negative once overdue. */
  days_remaining?: number | null;
  asset?: ServiceAsset | null;
};

export type BreachingRow = {
  request_id: number;
  request_number: string;
  subject: string;
  customer: string | null;
  priority: Priority;
  status: RequestStatus;
  response_late: boolean;
  resolution_late: boolean;
  /** Negative once past the deadline, which is what makes the queue sortable. */
  hours_remaining: number | null;
};

export type ServiceOverview = {
  range: { from: string | null; to: string | null };
  sla: {
    covered_requests: number;
    /** No contract, so no promise to judge them against. */
    uncovered_requests: number;
    response_met: number;
    response_breached: number;
    response_compliance_percent: number;
    resolution_met: number;
    resolution_breached: number;
    resolution_compliance_percent: number;
    /** Net of time waiting on the customer. */
    mean_resolution_hours: number;
    average_satisfaction: number | null;
  };
  queue: {
    total: number;
    open: number;
    on_hold: number;
    unacknowledged: number;
    by_status: Array<{ status: RequestStatus; label: string; count: number }>;
    by_priority: Array<{ priority: Priority; label: string; count: number }>;
  };
  work: {
    work_orders: number;
    open: number;
    overdue: number;
    completed: number;
    first_time_fix_percent: number;
    labour_hours: Numeric;
    labour_cost: Numeric;
    parts_cost: Numeric;
    total_cost: Numeric;
    billable_cost: Numeric;
    absorbed_cost: Numeric;
    by_coverage: Array<{ coverage: Coverage; label: string; count: number; cost: Numeric }>;
    by_type: Array<{ type: WorkOrderType; label: string; count: number }>;
  };
  assets: {
    total: number;
    operational: number;
    faulty: number;
    under_warranty: number;
    warranty_expiring: number;
    most_faults: Array<{
      asset_id: number;
      asset: string;
      customer: string | null;
      faults: number;
    }>;
  };
  contracts: {
    total: number;
    in_force: number;
    annual_value: Numeric;
    expiring_soon: number;
    by_tier: Array<{ tier: ContractTier; label: string; count: number; value: Numeric }>;
  };
  preventive: {
    plans: number;
    due_now: number;
    due_soon: number;
    upcoming: Array<{
      plan_id: number;
      name: string;
      asset: string;
      next_due_on: string | null;
      days_remaining: number | null;
      is_due: boolean;
    }>;
  };
  breaching: BreachingRow[];
  integrations: {
    crm: boolean;
    sales: boolean;
    inventory: boolean;
    human_resources: boolean;
  };
};
