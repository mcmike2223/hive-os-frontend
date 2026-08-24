export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
export interface Supplier {
  id: number;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  is_active?: boolean;
}
export interface ProcurementLine {
  line_key: string;
  description: string;
  quantity: number | string;
  unit?: string;
  unit_price: number | string;
  tax_rate?: number | string;
  line_total?: number | string;
  inventory_item_id?: number | null;
  accepted_quantity?: number | string;
  received_quantity?: number | string;
  rejected_quantity?: number | string;
  lot_number?: string | null;
  batch_number?: string | null;
  serial_numbers?: string[] | null;
  expiry_date?: string | null;
}
export interface SupplierProfile {
  id: number;
  supplier_id: number;
  legal_name?: string | null;
  tax_identification_number?: string | null;
  business_license_number?: string | null;
  country_code?: string | null;
  region?: string | null;
  city?: string | null;
  contact_person?: string | null;
  payment_terms?: string | null;
  lead_time_days?: number;
  categories?: string[] | null;
  certifications?: string[] | null;
  banking_details?: Record<string, unknown> | null;
  eligibility_documents?: string[] | null;
  eligibility_status: string;
  domestic_supplier: boolean;
  quality_score: number | string;
  delivery_score: number | string;
  responsiveness_score: number | string;
  invoice_accuracy_score: number | string;
  overall_score: number | string;
  debarred_until?: string | null;
  last_evaluated_at?: string | null;
  supplier?: Supplier;
}
export interface Requisition {
  id: number;
  number: string;
  title: string;
  business_justification?: string | null;
  requested_by?: number | null;
  department_id?: number | null;
  cost_center_id?: number | null;
  project_id?: number | null;
  procurement_method: string;
  priority: string;
  required_on?: string | null;
  currency: string;
  items: ProcurementLine[];
  estimated_subtotal?: number | string;
  estimated_tax?: number | string;
  estimated_total: number | string;
  budget_status: string;
  budget_notes?: string | null;
  budget_checked_at?: string | null;
  budget_checked_by?: number | null;
  status: string;
  workflow_status: string;
  rejection_reason?: string | null;
  attachments?: unknown[] | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: number | null;
  sourcing_events_count?: number;
  purchase_orders_count?: number;
  created_at: string;
}
export interface SupplierBid {
  id: number;
  supplier_id: number;
  reference?: string | null;
  items: ProcurementLine[];
  total: number | string;
  delivery_days: number;
  payment_terms?: string | null;
  valid_until?: string | null;
  documents?: string[] | null;
  technical_score: number | string;
  financial_score: number | string;
  preference_score: number | string;
  total_score: number | string;
  evaluation_notes?: string | null;
  status: string;
  recommended: boolean;
  supplier?: Supplier;
}
export interface SourcingEvaluationCriterion {
  key: string;
  weight: number;
}
export interface SourcingEvent {
  id: number;
  number: string;
  requisition_id?: number | null;
  title: string;
  method: string;
  scope?: string | null;
  estimated_value: number | string;
  currency: string;
  evaluation_criteria?: SourcingEvaluationCriterion[] | null;
  invited_supplier_ids?: number[] | null;
  documents?: string[] | null;
  egp_reference?: string | null;
  standard_bidding_document?: string | null;
  bid_security_amount?: number | string;
  performance_security_percent?: number | string;
  domestic_preference_percent?: number | string;
  tax_inclusive_evaluation?: boolean;
  status: string;
  clarification_deadline?: string | null;
  submission_deadline?: string | null;
  published_at?: string | null;
  opened_at?: string | null;
  awarded_at?: string | null;
  bids?: SupplierBid[];
  bids_count?: number;
  requisition?: Pick<Requisition, "id" | "number" | "title">;
}
export interface PurchaseOrder {
  id: number;
  number: string;
  supplier_id: number;
  requisition_id?: number | null;
  agreement_id?: number | null;
  sourcing_event_id?: number | null;
  project_id?: number | null;
  cost_center_id?: number | null;
  currency: string;
  exchange_rate?: number | string;
  items: ProcurementLine[];
  total: number | string;
  ordered_on: string;
  expected_on?: string | null;
  delivery_location?: string | null;
  terms?: Record<string, unknown> | null;
  attachments?: string[] | null;
  allow_over_receipt?: boolean;
  over_receipt_tolerance_percent?: number | string;
  status: string;
  revision_number: number;
  received_percent: number | string;
  invoiced_percent: number | string;
  supplier_confirmation_status: string;
  supplier_confirmation_reference?: string | null;
  supplier?: Supplier;
  requisition?: Pick<Requisition, "id" | "number" | "title">;
  receipts_count?: number;
  invoices_count?: number;
}
export interface GoodsReceipt {
  id: number;
  number: string;
  purchase_order_id: number;
  supplier_delivery_note?: string | null;
  received_on: string;
  items: ProcurementLine[];
  inspection_method: string;
  inspection_status: string;
  quality_notes?: string | null;
  nonconformance_reference?: string | null;
  quality_alert_status?: string | null;
  stock_posted_at?: string | null;
  attachments?: string[] | null;
  status: string;
  purchase_order?: PurchaseOrder;
}
export interface SupplierInvoice {
  id: number;
  number: string;
  supplier_invoice_number: string;
  purchase_order_id: number;
  invoice_date: string;
  due_date?: string | null;
  currency: string;
  items: ProcurementLine[];
  total: number | string;
  price_tolerance_percent?: number | string;
  quantity_tolerance_percent?: number | string;
  match_status: string;
  discrepancies?: Array<{
    line: number;
    type: string;
    message: string;
    expected?: number;
    actual?: number;
  }>;
  override_reason?: string | null;
  attachments?: string[] | null;
  status: string;
  finance_document_id?: number | null;
  purchase_order?: PurchaseOrder;
  finance_document?: { id: number; number: string; status: string };
}
export interface Agreement {
  id: number;
  number: string;
  supplier_id: number;
  type: string;
  title: string;
  starts_on: string;
  ends_on: string;
  currency: string;
  ceiling_amount: number | string;
  committed_amount: number | string;
  items?: ProcurementLine[] | null;
  service_levels?: string[] | Array<Record<string, unknown>> | null;
  documents?: string[] | null;
  auto_replenishment?: boolean;
  status: string;
  supplier?: Supplier;
}
export interface AuditEvent {
  id: number;
  entity_type: string;
  entity_id: number;
  event: string;
  actor_id?: number | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  occurred_at: string;
}
export interface ProcurementReferences {
  suppliers: Supplier[];
  inventory_items: Array<{
    id: number;
    sku: string;
    name: string;
    unit: string;
    current_stock: string;
    cost_price: string;
  }>;
  agreements: Agreement[];
  projects: Array<{ id: number; name: string; status: string }>;
  cost_centers: Array<{ id: number; code: string; name: string; is_active?: boolean }>;
  methods: Array<{ value: string; label: string }>;
}
export interface ProcurementDashboard {
  metrics: {
    requisitions_pending: number;
    sourcing_active: number;
    open_orders: number;
    committed_spend: number;
    overdue_deliveries: number;
    unmatched_invoices: number;
    match_rate: number;
    quality_pass_rate: number;
    agreements_expiring: number;
    eligible_suppliers: number;
  };
  pipeline: Array<{ status: string; count: number; value: number }>;
  monthly_spend: Array<{ month: string; ordered: number; invoiced: number }>;
  method_mix: Array<{ method: string; count: number; value: number }>;
  top_suppliers: SupplierProfile[];
  attention: {
    requisitions: Requisition[];
    orders: PurchaseOrder[];
    invoices: SupplierInvoice[];
  };
}
