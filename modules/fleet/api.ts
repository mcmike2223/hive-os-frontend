import http from "../shared/api/http";

/**
 * Fleet API (30 routes under `v1/fleet`).
 *
 * The shared client's baseURL already ends in `/api/v1`, so this base is
 * relative to that.
 */
const BASE_URL = "fleet";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const fleetApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // --------------------------------------------------------------- vehicles
  listVehicles: (params?: Params) => http.get(`${BASE_URL}/vehicles`, { params }),
  getVehicle: (id: number) => http.get(`${BASE_URL}/vehicles/${id}`),
  createVehicle: (data: Payload) => http.post(`${BASE_URL}/vehicles`, data),
  updateVehicle: (id: number, data: Payload) => http.put(`${BASE_URL}/vehicles/${id}`, data),
  retireVehicle: (id: number) => http.delete(`${BASE_URL}/vehicles/${id}`),

  // ---------------------------------------------------------------- drivers
  listDrivers: (params?: Params) => http.get(`${BASE_URL}/drivers`, { params }),
  createDriver: (data: Payload) => http.post(`${BASE_URL}/drivers`, data),
  updateDriver: (id: number, data: Payload) => http.put(`${BASE_URL}/drivers/${id}`, data),
  deleteDriver: (id: number) => http.delete(`${BASE_URL}/drivers/${id}`),

  // ------------------------------------------------------------ assignments
  listAssignments: (params?: Params) => http.get(`${BASE_URL}/assignments`, { params }),
  createAssignment: (data: Payload) => http.post(`${BASE_URL}/assignments`, data),
  endAssignment: (id: number, endsOn?: string) =>
    http.post(`${BASE_URL}/assignments/${id}/end`, endsOn ? { ends_on: endsOn } : {}),

  // ------------------------------------------------------------------ trips
  listTrips: (params?: Params) => http.get(`${BASE_URL}/trips`, { params }),
  createTrip: (data: Payload) => http.post(`${BASE_URL}/trips`, data),
  startTrip: (id: number, odometer?: number) =>
    http.post(`${BASE_URL}/trips/${id}/start`, odometer !== undefined ? { odometer_km: odometer } : {}),
  completeTrip: (id: number, odometer: number) =>
    http.post(`${BASE_URL}/trips/${id}/complete`, { odometer_km: odometer }),
  cancelTrip: (id: number) => http.post(`${BASE_URL}/trips/${id}/cancel`, {}),

  // ------------------------------------------------------------------- fuel
  fuelSummary: (params?: Params) => http.get(`${BASE_URL}/fuel/summary`, { params }),
  listFuel: (params?: Params) => http.get(`${BASE_URL}/fuel`, { params }),
  createFuel: (data: Payload) => http.post(`${BASE_URL}/fuel`, data),

  // ------------------------------------------------------------ maintenance
  maintenanceDue: (params?: Params) => http.get(`${BASE_URL}/maintenance/due`, { params }),
  listSchedules: (params?: Params) => http.get(`${BASE_URL}/maintenance/schedules`, { params }),
  createSchedule: (data: Payload) => http.post(`${BASE_URL}/maintenance/schedules`, data),
  deleteSchedule: (id: number) => http.delete(`${BASE_URL}/maintenance/schedules/${id}`),
  listServices: (params?: Params) => http.get(`${BASE_URL}/maintenance/services`, { params }),
  createService: (data: Payload) => http.post(`${BASE_URL}/maintenance/services`, data),

  // -------------------------------------------------------------- documents
  listDocuments: (params?: Params) => http.get(`${BASE_URL}/documents`, { params }),
  createDocument: (data: Payload) => http.post(`${BASE_URL}/documents`, data),
  deleteDocument: (id: number) => http.delete(`${BASE_URL}/documents/${id}`),
};

export default fleetApi;
