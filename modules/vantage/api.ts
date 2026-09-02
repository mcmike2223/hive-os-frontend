import http from "../shared/api/http";

/**
 * Vantage API (17 routes under `v1/vantage`).
 *
 * The shared client's baseURL already ends in `/api/v1`, so this base is
 * relative to that.
 */
const BASE_URL = "vantage";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const vantageApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // --------------------------------------------------------------- datasets
  listDatasets: (params?: Params) => http.get(`${BASE_URL}/datasets`, { params }),

  // ---------------------------------------------------------------- metrics
  listMetrics: (params?: Params) => http.get(`${BASE_URL}/metrics`, { params }),
  createMetric: (data: Payload) => http.post(`${BASE_URL}/metrics`, data),
  updateMetric: (id: number, data: Payload) => http.put(`${BASE_URL}/metrics/${id}`, data),
  /** Evaluate one metric now, optionally broken down by a dimension. */
  evaluateMetric: (id: number, params?: Params) =>
    http.get(`${BASE_URL}/metrics/${id}/evaluate`, { params }),

  // ------------------------------------------------------------- dashboards
  listDashboards: (params?: Params) => http.get(`${BASE_URL}/dashboards`, { params }),
  getDashboard: (id: number) => http.get(`${BASE_URL}/dashboards/${id}`),
  createDashboard: (data: Payload) => http.post(`${BASE_URL}/dashboards`, data),
  updateDashboard: (id: number, data: Payload) => http.put(`${BASE_URL}/dashboards/${id}`, data),
  deleteDashboard: (id: number) => http.delete(`${BASE_URL}/dashboards/${id}`),
  addWidget: (dashboardId: number, data: Payload) =>
    http.post(`${BASE_URL}/dashboards/${dashboardId}/widgets`, data),
  deleteWidget: (id: number) => http.delete(`${BASE_URL}/widgets/${id}`),

  // ----------------------------------------------------------------- alerts
  listAlerts: (params?: Params) => http.get(`${BASE_URL}/alerts`, { params }),
  createAlert: (data: Payload) => http.post(`${BASE_URL}/alerts`, data),
  updateAlert: (id: number, data: Payload) => http.put(`${BASE_URL}/alerts/${id}`, data),
  /** Re-evaluate every alert now rather than waiting for the scheduler. */
  runAlerts: () => http.post(`${BASE_URL}/alerts/run`, {}),

  // -------------------------------------------------------------- snapshots
  runSnapshots: () => http.post(`${BASE_URL}/snapshots/run`, {}),
};

export default vantageApi;
