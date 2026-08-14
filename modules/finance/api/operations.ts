import api from "@/modules/shared/api/http";

export type FinanceOperations = {
  compliance_profile: {
    id: number; code: string; name: string; reporting_framework: string; effective_from: string;
    vat_rate: string; goods_withholding_threshold: string; services_withholding_threshold: string;
    standard_withholding_rate: string; unlicensed_withholding_rate: string; cash_payment_limit: string; record_retention_years: number;
  };
  tax_obligations: Array<{ id: number; type: string; period_start: string; period_end: string; due_date: string; status: string; taxable_amount: string; tax_amount: string; paid_amount: string; filing_reference?: string | null }>;
  exchange_rates: Array<{ id: number; base_currency: string; quote_currency: string; effective_date: string; rate: string; rate_type: string; source: string; is_official: boolean }>;
  assets: Array<{ id: number; code: string; name: string; acquired_on: string; acquisition_cost: string; residual_value: string; accumulated_depreciation: string; useful_life_months: number; status: string }>;
  recurring_entries: Array<{ id: number; name: string; frequency: string; next_run_on: string; status: string; run_count: number }>;
  source_events: Array<{ id: number; source_module: string; event: string; event_date: string; amount: string; status: string; error_message?: string | null; journal?: { id: number; number: string; status: string } | null }>;
  bank_transactions: Array<{ id: number; account_id: number; account?: { code: string; name: string }; transaction_date: string; reference?: string | null; description: string; amount: string; direction: string; status: string }>;
};

type Payload = Record<string, unknown>;

export const financeOperationsApi = {
  get: async () => (await api.get<FinanceOperations>("/finance/operations")).data,
  exchangeRate: async (payload: Payload) => (await api.post("/finance/operations/exchange-rates", payload)).data,
  refreshTax: async (payload: Payload) => (await api.post("/finance/operations/tax-obligations/refresh", payload)).data,
  taxAction: async (id: number, action: "file" | "pay", payload: Payload = {}) => (await api.post(`/finance/operations/tax-obligations/${id}/actions/${action}`, payload)).data,
  asset: async (payload: Payload) => (await api.post("/finance/operations/assets", payload)).data,
  depreciateAsset: async (id: number, through_date: string) => (await api.post(`/finance/operations/assets/${id}/depreciate`, { through_date })).data,
  recurring: async (payload: Payload) => (await api.post("/finance/operations/recurring-entries", payload)).data,
  runRecurring: async (id: number, through_date: string) => (await api.post(`/finance/operations/recurring-entries/${id}/run`, { through_date })).data,
  sourceEventAction: async (id: number, action: "retry" | "ignore") => (await api.post(`/finance/operations/source-events/${id}/actions/${action}`)).data,
  bankTransaction: async (payload: Payload) => (await api.post("/finance/operations/bank-transactions", payload)).data,
  queueEinvoice: async (documentId: number) => (await api.post(`/finance/operations/documents/${documentId}/einvoice`)).data,
};
