import http from "../shared/api/http";

/**
 * Service and maintenance API (26 routes under `v1/service`).
 *
 * The shared client's baseURL already ends in `/api/v1`, so this base is
 * relative to that.
 */
const BASE_URL = "service";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const serviceApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // --------------------------------------------------------------- requests
  listRequests: (params?: Params) => http.get(`${BASE_URL}/requests`, { params }),
  getRequest: (id: number) => http.get(`${BASE_URL}/requests/${id}`),
  createRequest: (data: Payload) => http.post(`${BASE_URL}/requests`, data),
  transitionRequest: (id: number, status: string, resolutionSummary?: string) =>
    http.post(`${BASE_URL}/requests/${id}/transition`, {
      status,
      ...(resolutionSummary ? { resolution_summary: resolutionSummary } : {}),
    }),
  closeRequest: (id: number, satisfactionRating?: number) =>
    http.post(`${BASE_URL}/requests/${id}/close`, {
      ...(satisfactionRating ? { satisfaction_rating: satisfactionRating } : {}),
    }),
  /** Open requests whose clock has run out or is about to, worst first. */
  breaching: () => http.get(`${BASE_URL}/requests/breaching`),

  // -------------------------------------------------------------- contracts
  listContracts: (params?: Params) => http.get(`${BASE_URL}/contracts`, { params }),
  createContract: (data: Payload) => http.post(`${BASE_URL}/contracts`, data),
  updateContract: (id: number, data: Payload) => http.put(`${BASE_URL}/contracts/${id}`, data),

  // ----------------------------------------------------------------- assets
  listAssets: (params?: Params) => http.get(`${BASE_URL}/assets`, { params }),
  getAsset: (id: number) => http.get(`${BASE_URL}/assets/${id}`),
  createAsset: (data: Payload) => http.post(`${BASE_URL}/assets`, data),
  updateAsset: (id: number, data: Payload) => http.put(`${BASE_URL}/assets/${id}`, data),

  // ------------------------------------------------------------ technicians
  listTechnicians: (params?: Params) => http.get(`${BASE_URL}/technicians`, { params }),
  /** Least loaded first, optionally filtered to a needed skill. */
  availableTechnicians: (skill?: string) =>
    http.get(`${BASE_URL}/technicians/available`, { params: skill ? { skill } : undefined }),
  createTechnician: (data: Payload) => http.post(`${BASE_URL}/technicians`, data),
  updateTechnician: (id: number, data: Payload) => http.put(`${BASE_URL}/technicians/${id}`, data),

  // ------------------------------------------------------------ work orders
  listWorkOrders: (params?: Params) => http.get(`${BASE_URL}/work-orders`, { params }),
  createWorkOrder: (data: Payload) => http.post(`${BASE_URL}/work-orders`, data),
  transitionWorkOrder: (id: number, status: string) =>
    http.post(`${BASE_URL}/work-orders/${id}/transition`, { status }),
  addParts: (id: number, parts: Payload[]) =>
    http.post(`${BASE_URL}/work-orders/${id}/parts`, { parts }),
  completeWorkOrder: (id: number, data: Payload) =>
    http.post(`${BASE_URL}/work-orders/${id}/complete`, data),

  // ------------------------------------------------------- preventive plans
  listPlans: (params?: Params) => http.get(`${BASE_URL}/plans`, { params }),
  createPlan: (data: Payload) => http.post(`${BASE_URL}/plans`, data),
  deletePlan: (id: number) => http.delete(`${BASE_URL}/plans/${id}`),
};

export default serviceApi;
