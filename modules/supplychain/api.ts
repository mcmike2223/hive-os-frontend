import http from "../shared/api/http";

const BASE_URL = "supply-chain";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const supplyChainApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // Planning
  listProfiles: (params?: Params) => http.get(`${BASE_URL}/planning/profiles`, { params }),
  createProfile: (data: Payload) => http.post(`${BASE_URL}/planning/profiles`, data),
  updateProfile: (id: number, data: Payload) => http.put(`${BASE_URL}/planning/profiles/${id}`, data),
  deleteProfile: (id: number) => http.delete(`${BASE_URL}/planning/profiles/${id}`),

  listForecasts: (params?: Params) => http.get(`${BASE_URL}/planning/forecasts`, { params }),
  createForecast: (data: Payload) => http.post(`${BASE_URL}/planning/forecasts`, data),
  updateForecast: (id: number, data: Payload) => http.put(`${BASE_URL}/planning/forecasts/${id}`, data),
  deleteForecast: (id: number) => http.delete(`${BASE_URL}/planning/forecasts/${id}`),

  position: (params: Params) => http.get(`${BASE_URL}/planning/position`, { params }),

  // Replenishment
  listSuggestions: (params?: Params) => http.get(`${BASE_URL}/replenishment/suggestions`, { params }),
  runReplenishment: (data?: Payload) => http.post(`${BASE_URL}/replenishment/run`, data ?? {}),
  resolveSuggestion: (id: number, data: Payload) =>
    http.post(`${BASE_URL}/replenishment/suggestions/${id}/resolve`, data),
  procurementBridgeStatus: () => http.get(`${BASE_URL}/replenishment/procurement-bridge`),
  convertSuggestions: (data: Payload) => http.post(`${BASE_URL}/replenishment/convert`, data),

  // Routes
  listRoutes: (params?: Params) => http.get(`${BASE_URL}/routes`, { params }),
  getRoute: (id: number) => http.get(`${BASE_URL}/routes/${id}`),
  createRoute: (data: Payload) => http.post(`${BASE_URL}/routes`, data),
  updateRoute: (id: number, data: Payload) => http.put(`${BASE_URL}/routes/${id}`, data),
  deleteRoute: (id: number) => http.delete(`${BASE_URL}/routes/${id}`),

  // Shipments
  listShipments: (params?: Params) => http.get(`${BASE_URL}/shipments`, { params }),
  getShipment: (id: number) => http.get(`${BASE_URL}/shipments/${id}`),
  createShipment: (data: Payload) => http.post(`${BASE_URL}/shipments`, data),
  updateShipment: (id: number, data: Payload) => http.put(`${BASE_URL}/shipments/${id}`, data),
  transitionShipment: (id: number, status: string) =>
    http.post(`${BASE_URL}/shipments/${id}/transition`, { status }),
  recordDelivery: (id: number, data: Payload) => http.post(`${BASE_URL}/shipments/${id}/deliver`, data),

  // Transfers
  listTransfers: (params?: Params) => http.get(`${BASE_URL}/transfers`, { params }),
  getTransfer: (id: number) => http.get(`${BASE_URL}/transfers/${id}`),
  createTransfer: (data: Payload) => http.post(`${BASE_URL}/transfers`, data),
  updateTransfer: (id: number, data: Payload) => http.put(`${BASE_URL}/transfers/${id}`, data),
  transitionTransfer: (id: number, status: string) =>
    http.post(`${BASE_URL}/transfers/${id}/transition`, { status }),
  dispatchTransfer: (id: number, data?: Payload) =>
    http.post(`${BASE_URL}/transfers/${id}/dispatch`, data ?? {}),
  receiveTransfer: (id: number, data?: Payload) =>
    http.post(`${BASE_URL}/transfers/${id}/receive`, data ?? {}),

  // Returns
  listReturns: (params?: Params) => http.get(`${BASE_URL}/returns`, { params }),
  getReturn: (id: number) => http.get(`${BASE_URL}/returns/${id}`),
  createReturn: (data: Payload) => http.post(`${BASE_URL}/returns`, data),
  updateReturn: (id: number, data: Payload) => http.put(`${BASE_URL}/returns/${id}`, data),
  transitionReturn: (id: number, status: string) =>
    http.post(`${BASE_URL}/returns/${id}/transition`, { status }),
  inspectReturn: (id: number, data: Payload) => http.post(`${BASE_URL}/returns/${id}/inspect`, data),
  deleteReturn: (id: number) => http.delete(`${BASE_URL}/returns/${id}`),

  // Landed cost
  listLandedCosts: (params?: Params) => http.get(`${BASE_URL}/landed-costs`, { params }),
  getLandedCost: (id: number) => http.get(`${BASE_URL}/landed-costs/${id}`),
  createLandedCost: (data: Payload) => http.post(`${BASE_URL}/landed-costs`, data),
  updateLandedCost: (id: number, data: Payload) => http.put(`${BASE_URL}/landed-costs/${id}`, data),
  allocateLandedCost: (id: number) => http.post(`${BASE_URL}/landed-costs/${id}/allocate`),
  postLandedCost: (id: number) => http.post(`${BASE_URL}/landed-costs/${id}/post`),
  deleteLandedCost: (id: number) => http.delete(`${BASE_URL}/landed-costs/${id}`),
};
