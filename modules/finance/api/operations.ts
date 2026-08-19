import api from "@/modules/shared/api/http";

export type FinanceComplianceProfile = {
  id: number;
  code: string;
  name: string;
  jurisdiction?: string;
  reporting_framework: string;
  effective_from: string;
  effective_to?: string | null;
  vat_rate: string;
  goods_withholding_threshold: string;
  services_withholding_threshold: string;
  standard_withholding_rate: string;
  unlicensed_withholding_rate: string;
  cash_payment_limit: string;
  record_retention_years: number;
  is_default?: boolean;
};

export type FinanceOperations = {
  compliance_profile: FinanceComplianceProfile;
  profiles: FinanceComplianceProfile[];
  tax_obligations: Array<{ id: number; type: string; period_start: string; period_end: string; due_date: string; status: string; taxable_amount: string; tax_amount: string; paid_amount: string; filing_reference?: string | null }>;
  exchange_rates: Array<{ id: number; base_currency: string; quote_currency: string; effective_date: string; rate: string; rate_type: string; source: string; is_official: boolean }>;
  assets: Array<{ id: number; code: string; name: string; category?: string | null; acquired_on: string; acquisition_cost: string; residual_value: string; accumulated_depreciation: string; useful_life_months: number; status: string }>;
  recurring_entries: Array<{ id: number; name: string; frequency: string; next_run_on: string; starts_on?: string; status: string; run_count: number }>;
  source_events: Array<{ id: number; source_module: string; event: string; event_date: string; amount: string; status: string; error_message?: string | null; journal?: { id: number; number: string; status: string } | null }>;
  bank_transactions: Array<{
    id: number;
    account_id: number;
    account?: { code: string; name: string };
    transaction_date: string;
    reference?: string | null;
    description: string;
    amount: string;
    direction: string;
    status: string;
    match_confidence?: string | null;
    journal_line_id?: number | null;
    journalLine?: { id: number; journal?: { id: number; number: string; entry_date: string; memo?: string | null } | null } | null;
  }>;
};

export type FinanceBankTransactionDetail = {
  transaction: FinanceOperations["bank_transactions"][number];
  candidates: Array<{
    id: number;
    account_id: number;
    description?: string | null;
    debit: string;
    credit: string;
    journal?: { id: number; number: string; entry_date: string; memo?: string | null };
  }>;
};

type Payload = Record<string, unknown>;

export const financeOperationsApi = {
  get: async () => (await api.get<FinanceOperations>("/finance/operations")).data,
  complianceProfile: async (payload: Payload) => (await api.post<FinanceComplianceProfile>("/finance/operations/compliance-profiles", payload)).data,
  exchangeRate: async (payload: Payload) => (await api.post("/finance/operations/exchange-rates", payload)).data,
  refreshTax: async (payload: Payload) => (await api.post("/finance/operations/tax-obligations/refresh", payload)).data,
  taxAction: async (id: number, action: "file" | "pay", payload: Payload = {}) => (await api.post(`/finance/operations/tax-obligations/${id}/actions/${action}`, payload)).data,
  asset: async (payload: Payload) => (await api.post("/finance/operations/assets", payload)).data,
  depreciateAsset: async (id: number, through_date: string) =>
    (await api.post<{ asset: FinanceOperations["assets"][number]; journals: unknown[]; processed: number }>(`/finance/operations/assets/${id}/depreciate`, { through_date })).data,
  recurring: async (payload: Payload) => (await api.post("/finance/operations/recurring-entries", payload)).data,
  runRecurring: async (id: number, through_date: string) =>
    (await api.post<{ recurring_entry: FinanceOperations["recurring_entries"][number]; journals: unknown[]; processed: number }>(`/finance/operations/recurring-entries/${id}/run`, { through_date })).data,
  sourceEventAction: async (id: number, action: "retry" | "ignore") => (await api.post(`/finance/operations/source-events/${id}/actions/${action}`)).data,
  bankTransaction: async (payload: Payload) => (await api.post("/finance/operations/bank-transactions", payload)).data,
  getBankTransaction: async (id: number) => (await api.get<FinanceBankTransactionDetail>(`/finance/operations/bank-transactions/${id}`)).data,
  bankTransactionAction: async (id: number, action: "match" | "ignore", payload: Payload = {}) =>
    (await api.post(`/finance/operations/bank-transactions/${id}/actions/${action}`, payload)).data,
  queueEinvoice: async (documentId: number) => (await api.post(`/finance/operations/documents/${documentId}/einvoice`)).data,
};
