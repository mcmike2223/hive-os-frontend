import api from "@/modules/shared/api/http";

export const fetchSubscriptionCatalog = async () => (await api.get("/subscriptions/catalog")).data;
export const fetchCurrentTenantSubscriptions = async () => (await api.get("/subscriptions/current")).data;
export const updateCurrentTenantSubscriptions = async (data: unknown) => (await api.put("/subscriptions/current", data)).data;
export const startCurrentTenantSubscriptionCheckout = async (data: unknown) => (await api.post("/subscriptions/current/checkout", data)).data;
export const startCurrentTenantSubscriptionRenewal = async (data: unknown) => (await api.post("/subscriptions/current/renewal", data)).data;
export const syncCurrentTenantSubscriptionCheckout = async (token: string) => (await api.post(`/subscriptions/current/checkout/${token}/sync`)).data;
export const fetchPublicSubscriptionCatalog = async () => (await api.get("/public/subscriptions/catalog")).data;
export const startPublicSubscriptionCheckout = async (data: unknown) => (await api.post("/public/subscriptions/checkout", data)).data;
export const fetchPublicSubscriptionOrder = async (token: string) => (await api.get(`/public/subscriptions/orders/${token}`)).data;
export const fetchSubscriptionAdmin = async (params?: { search?: string }) => (await api.get("/subscriptions/admin", { params })).data;
export const updateSubscriptionAdminPlans = async (data: unknown) => (await api.put("/subscriptions/admin/plans", data)).data;
export const updateSubscriptionAdminPricing = async (data: unknown) => (await api.put("/subscriptions/admin/pricing", data)).data;
export const assignTenantSubscription = async (tenantId: string, data: unknown) => (await api.put(`/subscriptions/admin/tenants/${tenantId}`, data)).data;

// Demo Request API functions
export type DemoRequestPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company: string;
  company_size?: string;
  interests?: string[];
  message?: string;
};

export const submitDemoRequest = async (payload: DemoRequestPayload) => {
  const response = await fetch("/api/v1/public/demo-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : `Failed to submit demo request (${response.status})`,
    );
  }

  return body;
};

export const fetchDemoRequests = async (status?: string) =>
  (await api.get("/demo-requests", { params: status ? { status } : {} })).data;

export const updateDemoRequest = async (id: number, data: { status?: string; notes?: string }) =>
  (await api.put(`/demo-requests/${id}`, data)).data;

export default api;
