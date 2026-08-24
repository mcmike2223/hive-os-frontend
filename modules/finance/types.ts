export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};

export type FinanceAccount = {
  id: number;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  category?: string | null;
  normal_balance: "debit" | "credit";
  currency: string;
  opening_debit: string;
  opening_credit: string;
  is_bank: boolean;
  is_control: boolean;
  is_system: boolean;
  is_active: boolean;
  parent?: Pick<FinanceAccount, "id" | "code" | "name" | "type"> | null;
  children?: FinanceAccount[];
  lines_count?: number;
};

export type FinanceContact = {
  id: number;
  code: string;
  name: string;
  type: "customer" | "vendor" | "both";
  email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  business_license_number?: string | null;
  taxpayer_category?: "A" | "B" | null;
  is_vat_registered?: boolean;
  currency: string;
  credit_limit: string;
  payment_terms_days: number;
  address?: string | null;
  is_active: boolean;
  receivableAccount?: Pick<FinanceAccount, "id" | "code" | "name"> | null;
  payableAccount?: Pick<FinanceAccount, "id" | "code" | "name"> | null;
  documents?: FinanceDocument[];
};

export type FinanceJournalLine = {
  id: number;
  account_id: number;
  description?: string | null;
  debit: string;
  credit: string;
  account?: Pick<FinanceAccount, "id" | "code" | "name" | "type">;
};

export type FinanceJournal = {
  id: number;
  number: string;
  entry_date: string;
  type: string;
  status: "draft" | "posted" | "reversed";
  memo?: string | null;
  debit_total: string;
  credit_total: string;
  source_module?: string | null;
  lines?: FinanceJournalLine[];
  lines_count?: number;
};

export type FinanceDocumentLine = {
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_rate?: number;
  tax_amount?: number;
  line_total?: number;
  account_id?: number;
  inventory_item_id?: number;
};

export type FinanceDocument = {
  id: number;
  number: string;
  type: string;
  status: string;
  contact_id?: number | null;
  contact?: Pick<FinanceContact, "id" | "code" | "name" | "type"> | null;
  document_date: string;
  withholding_rate?: string;
  withholding_amount?: string;
  tax_invoice_type?: string;
  supply_category?: string;
  payment_method?: string | null;
  cash_control_status?: string;
  einvoice_status?: string;
  matching_status?: string;
  due_date?: string | null;
  currency: string;
  items: FinanceDocumentLine[];
  subtotal: string;
  tax_total: string;
  total: string;
  paid_amount: string;
  reference?: string | null;
  journal?: FinanceJournal | null;
  bankAccount?: Pick<FinanceAccount, "id" | "code" | "name"> | null;
};

export type FinanceBudget = {
  id: number;
  name: string;
  starts_on: string;
  ends_on: string;
  status: string;
  department?: string | null;
  cost_center?: string | null;
  currency: string;
  lines: Array<{ account_id: number; amount: number; notes?: string }>;
  total_amount: string;
};

export type FinanceBudgetDetail = {
  budget: FinanceBudget;
  variance: FinanceReport;
};

export type FinanceBankReconciliationItem = {
  kind: "add" | "subtract";
  description: string;
  amount: number;
};

export type FinanceBankReconciliation = {
  id: number;
  account_id: number;
  account?: Pick<FinanceAccount, "id" | "code" | "name">;
  statement_date: string;
  statement_balance: string;
  book_balance: string;
  difference: string;
  status: string;
  items?: FinanceBankReconciliationItem[];
  completed_at?: string | null;
};

export type FinancePeriod = {
  id: number;
  name: string;
  starts_on: string;
  ends_on: string;
  status: string;
};

export type FinanceTaxRate = {
  id: number;
  name: string;
  code: string;
  rate: string;
  kind: string;
  is_inclusive: boolean;
  is_active: boolean;
};

export type FinanceCostCenter = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
};

export type FinanceDashboard = {
  currency: string;
  metrics: { cash_balance: number; receivables: number; payables: number; net_income_ytd: number };
  book_health: { debits: number; credits: number; difference: number; unposted_journals: number; overdue_receivables: number; unreconciled_bank_accounts: number; locked_periods: number };
  datasets: {
    range: { from: string; to: string };
    performance: Array<{ period: string; label: string; revenue: number; expense: number; net: number }>;
    cash_flow: Array<{ period: string; label: string; inflow: number; outflow: number; net: number }>;
    aging: Array<{ bucket: string; receivables: number; payables: number }>;
    document_status: Array<{ status: string; documents: number; amount: number }>;
    module_activity: Array<{ module: string; events: number; posted: number; pending: number; amount: number }>;
    budget_vs_actual: Array<{ name: string; budget: number; actual: number; variance: number }>;
    compliance: { open_obligations: number; overdue_obligations: number; tax_due: number; withholding_accrued: number; cash_blocks: number; einvoice_pending: number };
    bank_matching: { unmatched: number; suggested: number; matched: number };
  };
  recent_journals: FinanceJournal[];
  recent_documents: FinanceDocument[];
};

export type FinanceReport = {
  report: string;
  generated_at: string;
  filters: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  totals: Record<string, unknown>;
};

export type FinanceAccountMapping = {
  id: number;
  source_module: string;
  event: string;
  debit_account_id: number;
  credit_account_id: number;
  tax_rate_id: number | null;
  is_active: boolean;
  debit_account?: { id: number; code: string; name: string };
  credit_account?: { id: number; code: string; name: string };
  tax_rate?: { id: number; code: string; name: string; rate: string } | null;
};

export type FinanceUnlockRequest = {
  id: number;
  period_id: number;
  status: string;
  reason: string;
  review_notes: string | null;
  requested_by: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  period?: FinancePeriod;
};

export type FinanceSettings = {
  system_accounts: FinanceAccount[];
  tax_rates: FinanceTaxRate[];
  cost_centers: FinanceCostCenter[];
  periods: FinancePeriod[];
  account_mappings: FinanceAccountMapping[];
  unlock_requests: FinanceUnlockRequest[];
};
