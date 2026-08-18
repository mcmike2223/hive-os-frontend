import http from "../shared/api/http";

/**
 * Sales API (40 routes under `v1/sales`).
 *
 * The shared client's baseURL already ends in `/api/v1`, so this base is
 * relative to that — not the full `v1/sales` the route file declares.
 */
const BASE_URL = "sales";

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;

export const salesApi = {
  overview: (params?: Params) => http.get(`${BASE_URL}/overview`, { params }),

  // ------------------------------------------------------------- customers
  listCustomers: (params?: Params) => http.get(`${BASE_URL}/customers`, { params }),
  createCustomer: (data: Payload) => http.post(`${BASE_URL}/customers`, data),
  updateCustomer: (id: number, data: Payload) => http.put(`${BASE_URL}/customers/${id}`, data),
  deleteCustomer: (id: number) => http.delete(`${BASE_URL}/customers/${id}`),

  // ----------------------------------------------------------- price lists
  listPriceLists: (params?: Params) => http.get(`${BASE_URL}/price-lists`, { params }),
  createPriceList: (data: Payload) => http.post(`${BASE_URL}/price-lists`, data),
  updatePriceList: (id: number, data: Payload) => http.put(`${BASE_URL}/price-lists/${id}`, data),
  deletePriceList: (id: number) => http.delete(`${BASE_URL}/price-lists/${id}`),

  listPriceListItems: (id: number, params?: Params) =>
    http.get(`${BASE_URL}/price-lists/${id}/items`, { params }),
  createPriceListItem: (id: number, data: Payload) =>
    http.post(`${BASE_URL}/price-lists/${id}/items`, data),
  deletePriceListItem: (itemId: number) => http.delete(`${BASE_URL}/price-lists/items/${itemId}`),

  priceCheck: (params: Params) => http.get(`${BASE_URL}/price-check`, { params }),

  // ------------------------------------------------------------ quotations
  listQuotations: (params?: Params) => http.get(`${BASE_URL}/quotations`, { params }),
  getQuotation: (id: number) => http.get(`${BASE_URL}/quotations/${id}`),
  createQuotation: (data: Payload) => http.post(`${BASE_URL}/quotations`, data),
  updateQuotationLines: (id: number, lines: unknown[]) =>
    http.put(`${BASE_URL}/quotations/${id}/lines`, { lines }),
  transitionQuotation: (id: number, status: string) =>
    http.post(`${BASE_URL}/quotations/${id}/transition`, { status }),
  convertQuotation: (id: number, data?: Payload) =>
    http.post(`${BASE_URL}/quotations/${id}/convert`, data ?? {}),

  // ---------------------------------------------------------------- orders
  fulfilmentStatus: () => http.get(`${BASE_URL}/orders/fulfilment-status`),
  listOrders: (params?: Params) => http.get(`${BASE_URL}/orders`, { params }),
  getOrder: (id: number) => http.get(`${BASE_URL}/orders/${id}`),
  createOrder: (data: Payload) => http.post(`${BASE_URL}/orders`, data),
  updateOrderLines: (id: number, lines: unknown[]) =>
    http.put(`${BASE_URL}/orders/${id}/lines`, { lines }),
  transitionOrder: (id: number, status: string) =>
    http.post(`${BASE_URL}/orders/${id}/transition`, { status }),
  availability: (id: number) => http.get(`${BASE_URL}/orders/${id}/availability`),
  deliverOrder: (id: number, deliveries: unknown[]) =>
    http.post(`${BASE_URL}/orders/${id}/deliver`, { deliveries }),
  shipOrder: (id: number) => http.post(`${BASE_URL}/orders/${id}/ship`, {}),
  invoicePreview: (id: number) => http.get(`${BASE_URL}/orders/${id}/invoice-preview`),
  markInvoiced: (id: number, documentId: number) =>
    http.post(`${BASE_URL}/orders/${id}/invoiced`, { invoice_document_id: documentId }),

  // --------------------------------------------------- targets and rewards
  listTargets: (params?: Params) => http.get(`${BASE_URL}/targets`, { params }),
  createTarget: (data: Payload) => http.post(`${BASE_URL}/targets`, data),
  deleteTarget: (id: number) => http.delete(`${BASE_URL}/targets/${id}`),

  commissionSummary: (params?: Params) => http.get(`${BASE_URL}/commissions/summary`, { params }),
  listCommissions: (params?: Params) => http.get(`${BASE_URL}/commissions`, { params }),
  listCommissionRules: (params?: Params) => http.get(`${BASE_URL}/commissions/rules`, { params }),
  createCommissionRule: (data: Payload) => http.post(`${BASE_URL}/commissions/rules`, data),
  updateCommissionRule: (id: number, data: Payload) =>
    http.put(`${BASE_URL}/commissions/rules/${id}`, data),
  deleteCommissionRule: (id: number) => http.delete(`${BASE_URL}/commissions/rules/${id}`),
  decideCommission: (id: number, status: string) =>
    http.post(`${BASE_URL}/commissions/${id}/decide`, { status }),
};

export default salesApi;
