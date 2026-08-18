import http from "../shared/api/http";

/**
 * CRM API (38 routes under `v1/crm`).
 *
 * The shared client's baseURL already ends in `/api/v1`, so this base is
 * relative to that.
 */
const BASE_URL = "crm";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const crmApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // ------------------------------------------------------------------ leads
  leadSummary: (params?: Params) => http.get(`${BASE_URL}/leads/summary`, { params }),
  listLeads: (params?: Params) => http.get(`${BASE_URL}/leads`, { params }),
  getLead: (id: number) => http.get(`${BASE_URL}/leads/${id}`),
  createLead: (data: Payload) => http.post(`${BASE_URL}/leads`, data),
  updateLead: (id: number, data: Payload) => http.put(`${BASE_URL}/leads/${id}`, data),
  transitionLead: (id: number, status: string, lostReason?: string) =>
    http.post(`${BASE_URL}/leads/${id}/transition`, {
      status,
      ...(lostReason ? { lost_reason: lostReason } : {}),
    }),
  convertLead: (id: number, data?: Payload) => http.post(`${BASE_URL}/leads/${id}/convert`, data ?? {}),

  // -------------------------------------------------------------- pipelines
  listPipelines: (params?: Params) => http.get(`${BASE_URL}/pipelines`, { params }),
  createPipeline: (data: Payload) => http.post(`${BASE_URL}/pipelines`, data),
  updateStages: (id: number, stages: unknown[]) =>
    http.put(`${BASE_URL}/pipelines/${id}/stages`, { stages }),
  makeDefaultPipeline: (id: number) => http.post(`${BASE_URL}/pipelines/${id}/default`, {}),

  // ---------------------------------------------------------- opportunities
  bridgeStatus: () => http.get(`${BASE_URL}/opportunities/bridge-status`),
  listOpportunities: (params?: Params) => http.get(`${BASE_URL}/opportunities`, { params }),
  getOpportunity: (id: number) => http.get(`${BASE_URL}/opportunities/${id}`),
  createOpportunity: (data: Payload) => http.post(`${BASE_URL}/opportunities`, data),
  updateOpportunity: (id: number, data: Payload) => http.put(`${BASE_URL}/opportunities/${id}`, data),
  moveStage: (id: number, stageId: number, lostReason?: string) =>
    http.post(`${BASE_URL}/opportunities/${id}/stage`, {
      stage_id: stageId,
      ...(lostReason ? { lost_reason: lostReason } : {}),
    }),
  reopenOpportunity: (id: number) => http.post(`${BASE_URL}/opportunities/${id}/reopen`, {}),
  createQuotation: (id: number) => http.post(`${BASE_URL}/opportunities/${id}/quotation`, {}),

  // --------------------------------------------------------------- accounts
  listAccounts: (params?: Params) => http.get(`${BASE_URL}/accounts`, { params }),
  getAccount: (id: number) => http.get(`${BASE_URL}/accounts/${id}`),
  createAccount: (data: Payload) => http.post(`${BASE_URL}/accounts`, data),
  updateAccount: (id: number, data: Payload) => http.put(`${BASE_URL}/accounts/${id}`, data),
  deleteAccount: (id: number) => http.delete(`${BASE_URL}/accounts/${id}`),
  linkCustomer: (id: number) => http.post(`${BASE_URL}/accounts/${id}/customer`, {}),

  // --------------------------------------------------------------- contacts
  listContacts: (params?: Params) => http.get(`${BASE_URL}/contacts`, { params }),
  createContact: (data: Payload) => http.post(`${BASE_URL}/contacts`, data),
  updateContact: (id: number, data: Payload) => http.put(`${BASE_URL}/contacts/${id}`, data),
  deleteContact: (id: number) => http.delete(`${BASE_URL}/contacts/${id}`),

  // ------------------------------------------------------------- activities
  listActivities: (params?: Params) => http.get(`${BASE_URL}/activities`, { params }),
  createActivity: (data: Payload) => http.post(`${BASE_URL}/activities`, data),
  completeActivity: (id: number, data?: Payload) =>
    http.post(`${BASE_URL}/activities/${id}/complete`, data ?? {}),
  cancelActivity: (id: number) => http.post(`${BASE_URL}/activities/${id}/cancel`, {}),

  // -------------------------------------------------------------- campaigns
  listCampaigns: (params?: Params) => http.get(`${BASE_URL}/campaigns`, { params }),
  createCampaign: (data: Payload) => http.post(`${BASE_URL}/campaigns`, data),
  updateCampaign: (id: number, data: Payload) => http.put(`${BASE_URL}/campaigns/${id}`, data),
  deleteCampaign: (id: number) => http.delete(`${BASE_URL}/campaigns/${id}`),
};

export default crmApi;
