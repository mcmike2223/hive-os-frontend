import http from "../shared/api/http";

/**
 * Agriculture API (20 routes under `v1/agriculture`).
 *
 * The shared client's baseURL already ends in `/api/v1`, so this base is
 * relative to that.
 */
const BASE_URL = "agriculture";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const agricultureApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // ----------------------------------------------------------------- fields
  listFields: (params?: Params) => http.get(`${BASE_URL}/fields`, { params }),
  createField: (data: Payload) => http.post(`${BASE_URL}/fields`, data),
  updateField: (id: number, data: Payload) => http.put(`${BASE_URL}/fields/${id}`, data),

  // ------------------------------------------------------------------ crops
  listCrops: (params?: Params) => http.get(`${BASE_URL}/crops`, { params }),
  createCrop: (data: Payload) => http.post(`${BASE_URL}/crops`, data),
  updateCrop: (id: number, data: Payload) => http.put(`${BASE_URL}/crops/${id}`, data),

  // ---------------------------------------------------------------- seasons
  listSeasons: (params?: Params) => http.get(`${BASE_URL}/seasons`, { params }),
  createSeason: (data: Payload) => http.post(`${BASE_URL}/seasons`, data),

  // -------------------------------------------------------------- plantings
  listPlantings: (params?: Params) => http.get(`${BASE_URL}/plantings`, { params }),
  getPlanting: (id: number) => http.get(`${BASE_URL}/plantings/${id}`),
  createPlanting: (data: Payload) => http.post(`${BASE_URL}/plantings`, data),
  transitionPlanting: (id: number, status: string, failureReason?: string) =>
    http.post(`${BASE_URL}/plantings/${id}/transition`, {
      status,
      ...(failureReason ? { failure_reason: failureReason } : {}),
    }),
  recordActivity: (id: number, data: Payload) =>
    http.post(`${BASE_URL}/plantings/${id}/activities`, data),
  /** Sets the yield every downstream figure is built on. */
  recordHarvest: (id: number, data: Payload) =>
    http.post(`${BASE_URL}/plantings/${id}/harvests`, data),
  /** Past their expected harvest date and still in the ground. */
  overdue: () => http.get(`${BASE_URL}/plantings/overdue`),

  // --------------------------------------------------------------- harvests
  listHarvests: (params?: Params) => http.get(`${BASE_URL}/harvests`, { params }),

  // -------------------------------------------------------------- livestock
  listLivestock: (params?: Params) => http.get(`${BASE_URL}/livestock`, { params }),
  createLivestock: (data: Payload) => http.post(`${BASE_URL}/livestock`, data),
  recordLivestock: (id: number, data: Payload) =>
    http.post(`${BASE_URL}/livestock/${id}/records`, data),
};

export default agricultureApi;
