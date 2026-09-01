/**
 * Sales types (proposal §5.5).
 *
 * Money and quantity fields carry Laravel `decimal:` casts, which arrive as
 * strings over JSON, so anything numeric is typed `Numeric` and coerced at the
 * render boundary rather than trusted to already be a number.
 */

export type Numeric = number | string | null;

export type Paginated<T> = {
  status: string;
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export type SalesCustomer = {
  id: number;
  code: string;
  name: string;
  finance_contact_id: number | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  tin: string | null;
  price_list_id: number | null;
  owner_employee_id: number | null;
  credit_limit: Numeric;
  payment_terms_days: number;
  is_active: boolean;
  notes: string | null;
  outstanding_balance?: Numeric;
  price_list?: SalesPriceList;
};

export type SalesPriceList = {
  id: number;
  code: string;
  name: string;
  currency: string;
  valid_from: string | null;
  valid_to: string | null;
  is_default: boolean;
  is_active: boolean;
  items_count?: number;
};

export type SalesPriceListItem = {
  id: number;
  price_list_id: number;
  product_id: number;
  unit_price: Numeric;
  min_quantity: Numeric;
  discount_percent: Numeric;
};

export type PriceResolution = {
  unit_price: number;
  discount_percent: number;
  price_list_id: number | null;
  /** "explicit" | "customer" | "default" | "unpriced" */
  source: string;
  pricing_hint?: {
    type: "min_quantity";
    min_quantity: number;
    unit_price: number;
    price_list_id: number;
    source: string;
  } | null;
};

export type QuotationStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "converted"
  | "cancelled";

export type SalesDocumentLine = {
  id: number;
  product_id: number;
  description: string | null;
  quantity: Numeric;
  unit_price: Numeric;
  discount_percent: Numeric;
  tax_percent: Numeric;
  line_total: Numeric;
  position: number;
};

export type SalesQuotation = {
  id: number;
  quotation_number: string;
  customer_id: number;
  price_list_id: number | null;
  owner_employee_id: number | null;
  issued_on: string;
  valid_until: string | null;
  currency: string;
  subtotal: Numeric;
  discount_total: Numeric;
  tax_total: Numeric;
  total: Numeric;
  status: QuotationStatus;
  converted_order_id: number | null;
  terms: string | null;
  notes: string | null;
  is_expired?: boolean;
  customer?: SalesCustomer;
  lines?: SalesDocumentLine[];
  order?: { id: number; order_number: string };
};

export type OrderStatus =
  | "draft"
  | "pending_approval"
  | "confirmed"
  | "fulfilled"
  | "closed"
  | "cancelled";

export type FulfilmentStatus = "pending" | "partial" | "complete";

export type SalesOrderLine = SalesDocumentLine & {
  order_id: number;
  delivered_quantity: Numeric;
  invoiced_quantity: Numeric;
  unit_cost: Numeric;
  outstanding_quantity?: Numeric;
  margin_amount?: Numeric;
};

export type SalesOrder = {
  id: number;
  order_number: string;
  customer_id: number;
  quotation_id: number | null;
  price_list_id: number | null;
  owner_employee_id: number | null;
  warehouse_id: number | null;
  ordered_on: string;
  requested_delivery_date: string | null;
  currency: string;
  subtotal: Numeric;
  discount_total: Numeric;
  tax_total: Numeric;
  total: Numeric;
  status: OrderStatus;
  fulfilment_status: FulfilmentStatus;
  shipment_id: number | null;
  invoice_document_id: number | null;
  production_order_id: number | null;
  customer_reference: string | null;
  notes: string | null;
  confirmed_at: string | null;
  fulfilment_percent?: Numeric;
  is_overdue?: boolean;
  customer?: SalesCustomer;
  lines?: SalesOrderLine[];
  commissions?: SalesCommission[];
};

export type Availability = {
  available: boolean;
  reason: string | null;
  lines: Array<{
    line_id: number;
    product_id: number;
    required: Numeric;
    on_hand: Numeric;
    shortfall: Numeric;
  }>;
};

export type FulfilmentCapabilities = {
  shipping: { available: boolean; module: string };
  invoicing: { available: boolean; module: string };
  production: { available: boolean; module: string };
};

export type SalesTarget = {
  id: number;
  period: string;
  owner_employee_id: number | null;
  scope: string;
  target_amount: Numeric;
  target_quantity: Numeric;
  currency: string;
  notes: string | null;
};

export type SalesCommissionRule = {
  id: number;
  name: string;
  basis: "revenue" | "margin";
  rate_percent: Numeric;
  minimum_amount: Numeric;
  price_list_id: number | null;
  segment: string | null;
  is_active: boolean;
};

export type SalesCommission = {
  id: number;
  order_id: number;
  rule_id: number | null;
  employee_id: number;
  period: string;
  basis_amount: Numeric;
  rate_percent: Numeric;
  amount: Numeric;
  status: "accrued" | "approved" | "paid" | "cancelled";
  approved_at: string | null;
  order?: SalesOrder;
};

export type SalesOverview = {
  range: { from: string | null; to: string | null };
  display_currency?: string;
  revenue: {
    booked: Numeric;
    orders: number;
    average_order_value: Numeric;
    margin: Numeric;
    margin_percent: Numeric;
    cancelled_orders: number;
    cancelled_value: Numeric;
  };
  pipeline: {
    quotations: number;
    open_value: Numeric;
    win_rate_percent: Numeric;
    expiring_soon: number;
    by_status: Array<{ status: string; label: string; count: number; value: Numeric }>;
  };
  fulfilment: {
    open_orders: number;
    open_value: Numeric;
    overdue_orders: number;
    awaiting_approval: number;
    by_status: Array<{ status: string; label: string; count: number }>;
  };
  customers: {
    active: number;
    total: number;
    top: Array<{ customer_id: number; customer: string; orders: number; revenue: Numeric }>;
  };
  products: Array<{ product_id: number; quantity: Numeric; revenue: Numeric }>;
  daily: Array<{ date: string; orders: number; revenue: Numeric }>;
  targets: {
    target_amount: Numeric;
    actual_amount: Numeric;
    attainment_percent: Numeric;
    by_owner: Array<{
      owner_employee_id: number | null;
      target: Numeric;
      actual: Numeric;
      attainment_percent: Numeric;
    }>;
  };
  commissions: {
    period: string | null;
    from?: string | null;
    to?: string | null;
    accrued: Numeric;
    approved: Numeric;
    paid: Numeric;
    earners: number;
    by_employee: Array<{ employee_id: number; orders: number; amount: Numeric }>;
  };
};
