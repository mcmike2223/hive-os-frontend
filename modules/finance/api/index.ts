import api from "@/modules/shared/api/http";
import type {
  FinanceAccount,
  FinanceBankReconciliation,
  FinanceBudget,
  FinanceBudgetDetail,
  FinanceContact,
  FinanceDashboard,
  FinanceDocument,
  FinanceJournal,
  FinanceReport,
  FinanceSettings,
  Paginated,
} from "@/modules/finance/types";

type Params = Record<string, string | number | boolean | undefined>;
type Payload = Record<string, unknown>;

export const financeApi = {
  dashboard: async (params: Params = {}) => (await api.get<FinanceDashboard>("/finance/dashboard", { params })).data,
  reports: async () => (await api.get<{ reports: Array<{ slug: string; name: string }> }>("/finance/reports")).data,
  accounts: async (params: Params = {}) => (await api.get<Paginated<FinanceAccount>>("/finance/accounts", { params })).data,
  getAccount: async (id: number) => (await api.get<FinanceAccount>(`/finance/accounts/${id}`)).data,
  createAccount: async (payload: Payload) => (await api.post<FinanceAccount>("/finance/accounts", payload)).data,
  updateAccount: async (id: number, payload: Payload) => (await api.patch<FinanceAccount>(`/finance/accounts/${id}`, payload)).data,
  deleteAccount: async (id: number) => (await api.delete(`/finance/accounts/${id}`)).data,
  contacts: async (params: Params = {}) => (await api.get<Paginated<FinanceContact>>("/finance/contacts", { params })).data,
  getContact: async (id: number) => (await api.get<FinanceContact>(`/finance/contacts/${id}`)).data,
  createContact: async (payload: Payload) => (await api.post<FinanceContact>("/finance/contacts", payload)).data,
  updateContact: async (id: number, payload: Payload) => (await api.patch<FinanceContact>(`/finance/contacts/${id}`, payload)).data,
  deleteContact: async (id: number) => (await api.delete(`/finance/contacts/${id}`)).data,
  journals: async (params: Params = {}) => (await api.get<Paginated<FinanceJournal>>("/finance/journals", { params })).data,
  createJournal: async (payload: Payload) => (await api.post<FinanceJournal>("/finance/journals", payload)).data,
  getJournal: async (id: number) => (await api.get<FinanceJournal>(`/finance/journals/${id}`)).data,
  updateJournal: async (id: number, payload: Payload) => (await api.patch<FinanceJournal>(`/finance/journals/${id}`, payload)).data,
  journalAction: async (id: number, action: "post" | "reverse", payload: Payload = {}) => (await api.post<FinanceJournal>(`/finance/journals/${id}/${action}`, payload)).data,
  documents: async (params: Params = {}) => (await api.get<Paginated<FinanceDocument>>("/finance/documents", { params })).data,
  getDocument: async (id: number) => (await api.get<FinanceDocument>(`/finance/documents/${id}`)).data,
  createDocument: async (payload: Payload) => (await api.post<FinanceDocument>("/finance/documents", payload)).data,
  updateDocument: async (id: number, payload: Payload) => (await api.patch<FinanceDocument>(`/finance/documents/${id}`, payload)).data,
  deleteDocument: async (id: number) => (await api.delete(`/finance/documents/${id}`)).data,
  documentAction: async (id: number, action: "approve" | "post" | "pay" | "void", payload: Payload = {}) => (await api.post<FinanceDocument>(`/finance/documents/${id}/actions/${action}`, payload)).data,
  documentPdfUrl: (id: number) => `/finance/documents/${id}/pdf`,
  budgets: async (params: Params = {}) => (await api.get<Paginated<FinanceBudget>>("/finance/budgets", { params })).data,
  createBudget: async (payload: Payload) => (await api.post<FinanceBudget>("/finance/budgets", payload)).data,
  getBudget: async (id: number) => (await api.get<FinanceBudgetDetail>(`/finance/budgets/${id}`)).data,
  updateBudget: async (id: number, payload: Payload) => (await api.patch<FinanceBudget>(`/finance/budgets/${id}`, payload)).data,
  deleteBudget: async (id: number) => (await api.delete(`/finance/budgets/${id}`)).data,
  budgetAction: async (id: number, action: "approve" | "lock" | "archive") => (await api.post<FinanceBudget>(`/finance/budgets/${id}/actions/${action}`)).data,
  reconciliations: async (params: Params = {}) => (await api.get<Paginated<FinanceBankReconciliation>>("/finance/bank-reconciliations", { params })).data,
  getReconciliation: async (id: number) => (await api.get<FinanceBankReconciliation>(`/finance/bank-reconciliations/${id}`)).data,
  createReconciliation: async (payload: Payload) => (await api.post<FinanceBankReconciliation>("/finance/bank-reconciliations", payload)).data,
  updateReconciliation: async (id: number, payload: Payload) => (await api.patch<FinanceBankReconciliation>(`/finance/bank-reconciliations/${id}`, payload)).data,
  completeReconciliation: async (id: number) => (await api.post<FinanceBankReconciliation>(`/finance/bank-reconciliations/${id}/complete`)).data,
  report: async (report: string, params: Params = {}) => (await api.get<FinanceReport>(`/finance/reports/${report}`, { params })).data,
  settings: async () => (await api.get<FinanceSettings>("/finance/settings")).data,
  createTaxRate: async (payload: Payload) => (await api.post("/finance/settings/tax-rates", payload)).data,
  updateTaxRate: async (id: number, payload: Payload) => (await api.patch(`/finance/settings/tax-rates/${id}`, payload)).data,
  createPeriod: async (payload: Payload) => (await api.post("/finance/settings/periods", payload)).data,
  periodAction: async (id: number, action: "lock" | "close") => (await api.post(`/finance/settings/periods/${id}/actions/${action}`)).data,
  requestUnlock: async (id: number, reason: string) => (await api.post(`/finance/settings/periods/${id}/unlock-requests`, { reason })).data,
  reviewUnlock: async (id: number, decision: "approved" | "rejected", review_notes?: string) => (await api.post(`/finance/settings/unlock-requests/${id}/review`, { decision, review_notes })).data,
  saveMapping: async (payload: Payload) => (await api.post("/finance/settings/account-mappings", payload)).data,
  syncHospitality: async () =>
    (await api.post<{
      processed: number;
      created: number;
      skipped: number;
      failed: number;
      available: number;
      message?: string;
      errors?: Array<{ posting_id: number; event: string; message: string }>;
    }>("/finance/integrations/hospitality/sync")).data,
};
