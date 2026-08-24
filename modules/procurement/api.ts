import api from "@/modules/shared/api/http";
import type {
  Agreement,
  AuditEvent,
  GoodsReceipt,
  Paginated,
  ProcurementDashboard,
  ProcurementReferences,
  PurchaseOrder,
  Requisition,
  SourcingEvent,
  SupplierBid,
  SupplierInvoice,
  SupplierProfile,
} from "@/modules/procurement/types";

type Params = Record<string, string | number | boolean | undefined>;
type Payload = Record<string, unknown>;
type Envelope<T> = { data: T };

const getPage = async <T>(path: string, params: Params = {}) =>
  (await api.get<Paginated<T>>(path, { params })).data;
const create = async <T>(path: string, payload: Payload) =>
  (await api.post<Envelope<T>>(path, payload)).data.data;
const update = async <T>(path: string, payload: Payload) =>
  (await api.patch<Envelope<T>>(path, payload)).data.data;
const action = async <T>(path: string, payload: Payload = {}) =>
  (await api.post<Envelope<T>>(path, payload)).data.data;

export const procurementApi = {
  dashboard: async () =>
    (await api.get<Envelope<ProcurementDashboard>>("/procurement/dashboard"))
      .data.data,
  references: async () =>
    (await api.get<Envelope<ProcurementReferences>>("/procurement/references"))
      .data.data,
  suppliers: (params: Params = {}) =>
    getPage<SupplierProfile>("/procurement/suppliers", params),
  createSupplier: (payload: Payload) =>
    create<SupplierProfile>("/procurement/suppliers", payload),
  updateSupplier: (id: number, payload: Payload) =>
    update<SupplierProfile>(`/procurement/suppliers/${id}`, payload),
  requisitions: (params: Params = {}) =>
    getPage<Requisition>("/procurement/requisitions", params),
  createRequisition: (payload: Payload) =>
    create<Requisition>("/procurement/requisitions", payload),
  updateRequisition: (id: number, payload: Payload) =>
    update<Requisition>(`/procurement/requisitions/${id}`, payload),
  requisitionAction: (id: number, verb: string, payload: Payload = {}) =>
    action<Requisition>(
      `/procurement/requisitions/${id}/actions/${verb}`,
      payload,
    ),
  sourcingEvents: (params: Params = {}) =>
    getPage<SourcingEvent>("/procurement/sourcing-events", params),
  createSourcingEvent: (payload: Payload) =>
    create<SourcingEvent>("/procurement/sourcing-events", payload),
  updateSourcingEvent: (id: number, payload: Payload) =>
    update<SourcingEvent>(`/procurement/sourcing-events/${id}`, payload),
  sourcingAction: (id: number, verb: string, payload: Payload = {}) =>
    action<SourcingEvent | PurchaseOrder>(
      `/procurement/sourcing-events/${id}/actions/${verb}`,
      payload,
    ),
  createBid: (eventId: number, payload: Payload) =>
    create<SupplierBid>(
      `/procurement/sourcing-events/${eventId}/bids`,
      payload,
    ),
  evaluateBid: (id: number, payload: Payload) =>
    action<SupplierBid>(`/procurement/supplier-bids/${id}/evaluate`, payload),
  purchaseOrders: (params: Params = {}) =>
    getPage<PurchaseOrder>("/procurement/purchase-orders", params),
  createPurchaseOrder: (payload: Payload) =>
    create<PurchaseOrder>("/procurement/purchase-orders", payload),
  updatePurchaseOrder: (id: number, payload: Payload) =>
    update<PurchaseOrder>(`/procurement/purchase-orders/${id}`, payload),
  purchaseOrderAction: (id: number, verb: string, payload: Payload = {}) =>
    action<PurchaseOrder>(
      `/procurement/purchase-orders/${id}/actions/${verb}`,
      payload,
    ),
  receipts: (params: Params = {}) =>
    getPage<GoodsReceipt>("/procurement/goods-receipts", params),
  createReceipt: (payload: Payload) =>
    create<GoodsReceipt>("/procurement/goods-receipts", payload),
  inspectReceipt: (id: number, payload: Payload) =>
    action<GoodsReceipt>(`/procurement/goods-receipts/${id}/inspect`, payload),
  postReceipt: (id: number) =>
    action<GoodsReceipt>(`/procurement/goods-receipts/${id}/post`),
  invoices: (params: Params = {}) =>
    getPage<SupplierInvoice>("/procurement/supplier-invoices", params),
  createInvoice: (payload: Payload) =>
    create<SupplierInvoice>("/procurement/supplier-invoices", payload),
  updateInvoice: (id: number, payload: Payload) =>
    update<SupplierInvoice>(`/procurement/supplier-invoices/${id}`, payload),
  invoiceAction: (id: number, verb: string, payload: Payload = {}) =>
    action<SupplierInvoice>(
      `/procurement/supplier-invoices/${id}/actions/${verb}`,
      payload,
    ),
  agreements: (params: Params = {}) =>
    getPage<Agreement>("/procurement/agreements", params),
  createAgreement: (payload: Payload) =>
    create<Agreement>("/procurement/agreements", payload),
  updateAgreement: (id: number, payload: Payload) =>
    update<Agreement>(`/procurement/agreements/${id}`, payload),
  agreementAction: (id: number, verb: string) =>
    action<Agreement>(`/procurement/agreements/${id}/actions/${verb}`),
  auditEvents: (params: Params = {}) =>
    getPage<AuditEvent>("/procurement/audit-events", params),
  reportSummary: async () =>
    (
      await api.get<Envelope<ProcurementDashboard>>("/procurement/reports/summary")
    ).data.data,
  exportReport: async (dataset: string) =>
    (
      await api.get<Blob>("/procurement/reports/export", {
        params: { dataset },
        responseType: "blob",
      })
    ).data,
};
