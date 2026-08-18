import http from "../shared/api/http";

/**
 * Internal audit API (24 routes under `v1/internal-audit`).
 *
 * The shared client's baseURL already ends in `/api/v1`, so this base is
 * relative to that. Prefixed `internal-audit` rather than `audit` so it is
 * never confused with the system audit log.
 */
const BASE_URL = "internal-audit";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const internalAuditApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // ------------------------------------------------------------------ areas
  listAreas: (params?: Params) => http.get(`${BASE_URL}/areas`, { params }),
  /** The plan: what is due, ranked by the risk that makes being due matter. */
  coverage: () => http.get(`${BASE_URL}/areas/coverage`),
  createArea: (data: Payload) => http.post(`${BASE_URL}/areas`, data),
  updateArea: (id: number, data: Payload) => http.put(`${BASE_URL}/areas/${id}`, data),

  // ------------------------------------------------------------ engagements
  listEngagements: (params?: Params) => http.get(`${BASE_URL}/engagements`, { params }),
  getEngagement: (id: number) => http.get(`${BASE_URL}/engagements/${id}`),
  createEngagement: (data: Payload) => http.post(`${BASE_URL}/engagements`, data),
  transitionEngagement: (id: number, data: Payload) =>
    http.post(`${BASE_URL}/engagements/${id}/transition`, data),
  addProcedure: (engagementId: number, data: Payload) =>
    http.post(`${BASE_URL}/engagements/${engagementId}/procedures`, data),

  // ------------------------------------------------------------- procedures
  listProcedures: (params?: Params) => http.get(`${BASE_URL}/procedures`, { params }),

  // --------------------------------------------------------------- findings
  listFindings: (params?: Params) => http.get(`${BASE_URL}/findings`, { params }),
  getFinding: (id: number) => http.get(`${BASE_URL}/findings/${id}`),
  createFinding: (data: Payload) => http.post(`${BASE_URL}/findings`, data),
  transitionFinding: (id: number, status: string, note?: string) =>
    http.post(`${BASE_URL}/findings/${id}/transition`, {
      status,
      ...(note ? { note } : {}),
    }),
  agreeAction: (findingId: number, data: Payload) =>
    http.post(`${BASE_URL}/findings/${findingId}/actions`, data),

  // ---------------------------------------------------------------- actions
  listActions: (params?: Params) => http.get(`${BASE_URL}/actions`, { params }),
  /** Everything management still owes, worst first. */
  outstandingActions: () => http.get(`${BASE_URL}/actions/outstanding`),
  completeAction: (id: number, completedOn?: string) =>
    http.post(`${BASE_URL}/actions/${id}/complete`, completedOn ? { completed_on: completedOn } : {}),
  verifyAction: (id: number, data: Payload) => http.post(`${BASE_URL}/actions/${id}/verify`, data),
  cancelAction: (id: number, reason: string) =>
    http.post(`${BASE_URL}/actions/${id}/cancel`, { reason }),

  // ------------------------------------------------------------------ risks
  listRisks: (params?: Params) => http.get(`${BASE_URL}/risks`, { params }),
  createRisk: (data: Payload) => http.post(`${BASE_URL}/risks`, data),
  updateRisk: (id: number, data: Payload) => http.put(`${BASE_URL}/risks/${id}`, data),
};

export default internalAuditApi;
