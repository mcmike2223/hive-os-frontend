import api from "@/modules/shared/api/http";

export { api };

export const fetchLogs = async (params: any = {}) => (await api.get("/logs", { params })).data;
export const logFrontendAction = async (payload: { module: string; action: string; description: string }) =>
  (await api.post("/logs/client-action", payload)).data;

// 🗑️ GLOBAL TRASH BIN API
export const fetchTrashItems = async (params: any = {}) => (await api.get("/trash", { params })).data;
export const fetchTrashStats = async () => (await api.get("/trash/stats")).data;
export const restoreTrashItem = async (entityType: string, id: string | number) =>
  (await api.post(`/trash/${entityType}/${id}/restore`)).data;
export const forceDeleteTrashItem = async (entityType: string, id: string | number) =>
  (await api.delete(`/trash/${entityType}/${id}/force`)).data;
export const restoreAllTrash = async (entityType?: string) =>
  (await api.post("/trash/restore-all", { entity_type: entityType })).data;
export const emptyTrash = async (entityType?: string) =>
  (await api.post("/trash/empty", { entity_type: entityType })).data;
export const fetchTrashSettings = async () => (await api.get("/trash/settings")).data;
export const updateTrashSettings = async (retentionDays: number) =>
  (await api.post("/trash/settings", { retention_days: retentionDays })).data;
export const purgeExpiredTrash = async (days: number = 30) =>
  (await api.post("/trash/purge-expired", { days })).data;

export default api;
