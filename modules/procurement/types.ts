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
}
export interface SupplierProfile {
  id: number;
  supplier_id: number;
  legal_name?: string | null;
  eligibility_status: string;
  domestic_supplier: boolean;
  quality_score: number | string;
  delivery_score: number | string;
  responsiveness_score: number | string;
  invoice_accuracy_score: number | string;
  overall_score: number | string;
  debarred_until?: string | null;
  supplier?: Supplier;
}
export interface Requisition {
  id: number;
  number: string;
  title: string;
  business_justification?: string | null;
  procurement_method: string;
  priority: string;
  required_on?: string | null;
  currency: string;
  items: ProcurementLine[];
  estimated_total: number | string;
  budget_status: string;
  status: string;
  workflow_status: string;
  created_at: string;
}
export interface SupplierBid {
  id: number;
  supplier_id: number;
  reference?: string | null;
  items: ProcurementLine[];
  total: number | string;
  delivery_days: number;
  technical_score: number | string;
  financial_score: number | string;
  preference_score: number | string;
  total_score: number | string;
  status: string;
  recommended: boolean;
  supplier?: Supplier;
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
  egp_reference?: string | null;
  status: string;
  submission_deadline?: string | null;
  bids?: SupplierBid[];
  bids_count?: number;
  requisition?: Pick<Requisition, "id" | "number" | "title">;
}
export interface PurchaseOrder {
  id: number;
  number: string;
  supplier_id: number;
  requisition_id?: number | null;
  currency: string;
  items: ProcurementLine[];
  total: number | string;
  ordered_on: string;
  expected_on?: string | null;
  delivery_location?: string | null;
  status: string;
  revision_number: number;
  received_percent: number | string;
  invoiced_percent: number | string;
  supplier_confirmation_status: string;
  supplier?: Supplier;
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
  nonconformance_reference?: string | null;
  stock_posted_at?: string | null;
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
  match_status: string;
  discrepancies?: Array<{
    line: number;
    type: string;
    message: string;
    expected?: number;
    actual?: number;
  }>;
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
  status: string;
  supplier?: Supplier;
}
export interface AuditEvent {
  id: number;
  entity_type: string;
  entity_id: number;
  event: string;
  actor_id?: number | null;
  context?: Record<string, unknown>;
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
  cost_centers: Array<{ id: number; code: string; name: string }>;
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
