import api from "@/modules/shared/api/http";
import type {
  FinanceAccount,
  FinanceBankReconciliation,
  FinanceBudget,
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
  accounts: async (params: Params = {}) => (await api.get<Paginated<FinanceAccount>>("/finance/accounts", { params })).data,
  createAccount: async (payload: Payload) => (await api.post<FinanceAccount>("/finance/accounts", payload)).data,
  updateAccount: async (id: number, payload: Payload) => (await api.patch<FinanceAccount>(`/finance/accounts/${id}`, payload)).data,
  contacts: async (params: Params = {}) => (await api.get<Paginated<FinanceContact>>("/finance/contacts", { params })).data,
  createContact: async (payload: Payload) => (await api.post<FinanceContact>("/finance/contacts", payload)).data,
  updateContact: async (id: number, payload: Payload) => (await api.patch<FinanceContact>(`/finance/contacts/${id}`, payload)).data,
  journals: async (params: Params = {}) => (await api.get<Paginated<FinanceJournal>>("/finance/journals", { params })).data,
  createJournal: async (payload: Payload) => (await api.post<FinanceJournal>("/finance/journals", payload)).data,
  journalAction: async (id: number, action: "post" | "reverse", payload: Payload = {}) => (await api.post<FinanceJournal>(`/finance/journals/${id}/${action}`, payload)).data,
  documents: async (params: Params = {}) => (await api.get<Paginated<FinanceDocument>>("/finance/documents", { params })).data,
  createDocument: async (payload: Payload) => (await api.post<FinanceDocument>("/finance/documents", payload)).data,
  updateDocument: async (id: number, payload: Payload) => (await api.patch<FinanceDocument>(`/finance/documents/${id}`, payload)).data,
  documentAction: async (id: number, action: "approve" | "post" | "pay" | "void", payload: Payload = {}) => (await api.post<FinanceDocument>(`/finance/documents/${id}/actions/${action}`, payload)).data,
  documentPdfUrl: (id: number) => `/finance/documents/${id}/pdf`,
  budgets: async (params: Params = {}) => (await api.get<Paginated<FinanceBudget>>("/finance/budgets", { params })).data,
  createBudget: async (payload: Payload) => (await api.post<FinanceBudget>("/finance/budgets", payload)).data,
  budgetAction: async (id: number, action: "approve" | "lock" | "archive") => (await api.post<FinanceBudget>(`/finance/budgets/${id}/actions/${action}`)).data,
  reconciliations: async (params: Params = {}) => (await api.get<Paginated<FinanceBankReconciliation>>("/finance/bank-reconciliations", { params })).data,
  createReconciliation: async (payload: Payload) => (await api.post<FinanceBankReconciliation>("/finance/bank-reconciliations", payload)).data,
  completeReconciliation: async (id: number) => (await api.post<FinanceBankReconciliation>(`/finance/bank-reconciliations/${id}/complete`)).data,
  report: async (report: string, params: Params = {}) => (await api.get<FinanceReport>(`/finance/reports/${report}`, { params })).data,
  settings: async () => (await api.get<FinanceSettings>("/finance/settings")).data,
  createTaxRate: async (payload: Payload) => (await api.post("/finance/settings/tax-rates", payload)).data,
  createPeriod: async (payload: Payload) => (await api.post("/finance/settings/periods", payload)).data,
  periodAction: async (id: number, action: "lock" | "close") => (await api.post(`/finance/settings/periods/${id}/actions/${action}`)).data,
  requestUnlock: async (id: number, reason: string) => (await api.post(`/finance/settings/periods/${id}/unlock-requests`, { reason })).data,
  reviewUnlock: async (id: number, decision: "approved" | "rejected", review_notes?: string) => (await api.post(`/finance/settings/unlock-requests/${id}/review`, { decision, review_notes })).data,
  saveMapping: async (payload: Payload) => (await api.post("/finance/settings/account-mappings", payload)).data,
  syncHospitality: async () => (await api.post<{ processed: number }>("/finance/integrations/hospitality/sync")).data,
};
