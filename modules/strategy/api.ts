import http from "../shared/api/http";

/**
 * Strategic planning API (21 routes under `v1/strategy`).
 *
 * The shared client's baseURL already ends in `/api/v1`, so this base is
 * relative to that.
 */
const BASE_URL = "strategy";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const strategyApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // ------------------------------------------------------------------ plans
  listPlans: (params?: Params) => http.get(`${BASE_URL}/plans`, { params }),
  /** The full scored tree for one plan. Optional `as_of` for a historical snapshot. */
  scorecard: (id: number, params?: Params) =>
    http.get(`${BASE_URL}/plans/${id}/scorecard`, { params }),
  createPlan: (data: Payload) => http.post(`${BASE_URL}/plans`, data),
  updatePlan: (id: number, data: Payload) => http.put(`${BASE_URL}/plans/${id}`, data),

  // ----------------------------------------------------------- perspectives
  listPerspectives: (params?: Params) => http.get(`${BASE_URL}/perspectives`, { params }),
  createPerspective: (data: Payload) => http.post(`${BASE_URL}/perspectives`, data),
  updatePerspective: (id: number, data: Payload) => http.put(`${BASE_URL}/perspectives/${id}`, data),

  // ------------------------------------------------------------- objectives
  listObjectives: (params?: Params) => http.get(`${BASE_URL}/objectives`, { params }),
  getObjective: (id: number) => http.get(`${BASE_URL}/objectives/${id}`),
  createObjective: (data: Payload) => http.post(`${BASE_URL}/objectives`, data),
  updateObjective: (id: number, data: Payload) => http.put(`${BASE_URL}/objectives/${id}`, data),

  // ------------------------------------------------------------------- kpis
  listKpis: (params?: Params) => http.get(`${BASE_URL}/kpis`, { params }),
  createKpi: (data: Payload) => http.post(`${BASE_URL}/kpis`, data),
  updateKpi: (id: number, data: Payload) => http.put(`${BASE_URL}/kpis/${id}`, data),
  listReadings: (kpiId: number, params?: Params) =>
    http.get(`${BASE_URL}/kpis/${kpiId}/readings`, { params }),
  /** Recording an actual is a separate right from defining the measure. */
  recordReading: (kpiId: number, data: Payload) =>
    http.post(`${BASE_URL}/kpis/${kpiId}/readings`, data),

  // ------------------------------------------------------------ initiatives
  listInitiatives: (params?: Params) => http.get(`${BASE_URL}/initiatives`, { params }),
  createInitiative: (data: Payload) => http.post(`${BASE_URL}/initiatives`, data),
  updateInitiative: (id: number, data: Payload) => http.put(`${BASE_URL}/initiatives/${id}`, data),

  // ---------------------------------------------------------------- reviews
  listReviews: (params?: Params) => http.get(`${BASE_URL}/reviews`, { params }),
  createReview: (data: Payload) => http.post(`${BASE_URL}/reviews`, data),
};

export default strategyApi;
