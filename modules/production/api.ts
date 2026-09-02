import http from "../shared/api/http";
import type {
  ProductionBom,
  ProductionLine,
  ProductionOrder,
  ProductionRun,
  SanitationLog,
  WaterTreatmentLog,
} from "./types";

const BASE_URL = "production";

export const productionApi = {
  // Dashboard and traceability
  overview: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/overview`, { params }),
  traceBatch: (batchNumber: string) =>
    http.get(`${BASE_URL}/trace/${encodeURIComponent(batchNumber)}`),

  // Lines
  listLines: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/lines`, { params }),
  getLine: (id: number) => http.get(`${BASE_URL}/lines/${id}`),
  createLine: (data: Partial<ProductionLine>) => http.post(`${BASE_URL}/lines`, data),
  updateLine: (id: number, data: Partial<ProductionLine>) => http.put(`${BASE_URL}/lines/${id}`, data),
  deleteLine: (id: number) => http.delete(`${BASE_URL}/lines/${id}`),

  // Bills of materials
  listBoms: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/boms`, { params }),
  getBom: (id: number) => http.get(`${BASE_URL}/boms/${id}`),
  createBom: (data: Record<string, unknown>) => http.post(`${BASE_URL}/boms`, data),
  updateBom: (id: number, data: Record<string, unknown>) => http.put(`${BASE_URL}/boms/${id}`, data),
  activateBom: (id: number) => http.post(`${BASE_URL}/boms/${id}/activate`),
  deleteBom: (id: number) => http.delete(`${BASE_URL}/boms/${id}`),

  // Work orders
  listOrders: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/orders`, { params }),
  exportOrders: (params?: Record<string, unknown>) =>
    http.get(`${BASE_URL}/orders/export`, { params, responseType: "blob" }),
  getOrder: (id: number) => http.get(`${BASE_URL}/orders/${id}`),
  createOrder: (data: Record<string, unknown>) => http.post(`${BASE_URL}/orders`, data),
  updateOrder: (id: number, data: Partial<ProductionOrder>) => http.put(`${BASE_URL}/orders/${id}`, data),
  transitionOrder: (id: number, status: string) =>
    http.post(`${BASE_URL}/orders/${id}/transition`, { status }),
  issueMaterial: (id: number, data: Record<string, unknown>) =>
    http.post(`${BASE_URL}/orders/${id}/materials`, data),
  recordQaDecision: (id: number, data: { decision: string; notes?: string }) =>
    http.post(`${BASE_URL}/orders/${id}/qa-decision`, data),
  deleteOrder: (id: number) => http.delete(`${BASE_URL}/orders/${id}`),

  // Shift runs
  listRuns: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/runs`, { params }),
  getRun: (id: number) => http.get(`${BASE_URL}/runs/${id}`),
  createRun: (data: Partial<ProductionRun>) => http.post(`${BASE_URL}/runs`, data),
  updateRun: (id: number, data: Partial<ProductionRun>) => http.put(`${BASE_URL}/runs/${id}`, data),
  deleteRun: (id: number) => http.delete(`${BASE_URL}/runs/${id}`),

  // Downtime
  listDowntimeReasons: () => http.get(`${BASE_URL}/downtime/reasons`),
  downtimePareto: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/downtime/pareto`, { params }),
  listDowntime: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/downtime`, { params }),
  createDowntime: (data: Record<string, unknown>) => http.post(`${BASE_URL}/downtime`, data),
  updateDowntime: (id: number, data: Record<string, unknown>) => http.put(`${BASE_URL}/downtime/${id}`, data),
  deleteDowntime: (id: number) => http.delete(`${BASE_URL}/downtime/${id}`),

  // Water treatment
  treatmentSpecification: () => http.get(`${BASE_URL}/water-treatment/specification`),
  listTreatmentLogs: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/water-treatment`, { params }),
  getTreatmentLog: (id: number) => http.get(`${BASE_URL}/water-treatment/${id}`),
  createTreatmentLog: (data: Partial<WaterTreatmentLog>) => http.post(`${BASE_URL}/water-treatment`, data),
  updateTreatmentLog: (id: number, data: Partial<WaterTreatmentLog>) =>
    http.put(`${BASE_URL}/water-treatment/${id}`, data),
  deleteTreatmentLog: (id: number) => http.delete(`${BASE_URL}/water-treatment/${id}`),

  // Returnable containers and deposits
  containerSummary: () => http.get(`${BASE_URL}/containers/summary`),
  listContainerBalances: (params?: Record<string, unknown>) =>
    http.get(`${BASE_URL}/containers/balances`, { params }),
  customerStatement: (customerContactId: number, params?: Record<string, unknown>) =>
    http.get(`${BASE_URL}/containers/statements/${customerContactId}`, { params }),
  listContainerTypes: (params?: Record<string, unknown>) =>
    http.get(`${BASE_URL}/containers/types`, { params }),
  createContainerType: (data: Record<string, unknown>) => http.post(`${BASE_URL}/containers/types`, data),
  updateContainerType: (id: number, data: Record<string, unknown>) =>
    http.put(`${BASE_URL}/containers/types/${id}`, data),
  deleteContainerType: (id: number) => http.delete(`${BASE_URL}/containers/types/${id}`),
  listContainerMovements: (params?: Record<string, unknown>) =>
    http.get(`${BASE_URL}/containers/movements`, { params }),
  createContainerMovement: (data: Record<string, unknown>) =>
    http.post(`${BASE_URL}/containers/movements`, data),

  // Sanitation / CIP
  listSanitationLogs: (params?: Record<string, unknown>) => http.get(`${BASE_URL}/sanitation`, { params }),
  getSanitationLog: (id: number) => http.get(`${BASE_URL}/sanitation/${id}`),
  createSanitationLog: (data: Partial<SanitationLog>) => http.post(`${BASE_URL}/sanitation`, data),
  updateSanitationLog: (id: number, data: Partial<SanitationLog>) =>
    http.put(`${BASE_URL}/sanitation/${id}`, data),
  verifySanitationLog: (id: number, data: Record<string, unknown>) =>
    http.post(`${BASE_URL}/sanitation/${id}/verify`, data),
  deleteSanitationLog: (id: number) => http.delete(`${BASE_URL}/sanitation/${id}`),
};

export type { ProductionBom, ProductionLine, ProductionOrder, ProductionRun };
