import api from "@/modules/shared/api/http";

export const fetchSubscriptionCatalog = async () => (await api.get("/subscriptions/catalog")).data;
export const fetchCurrentTenantSubscriptions = async () => (await api.get("/subscriptions/current")).data;
export const updateCurrentTenantSubscriptions = async (data: unknown) => (await api.put("/subscriptions/current", data)).data;
export const startCurrentTenantSubscriptionCheckout = async (data: unknown) => (await api.post("/subscriptions/current/checkout", data)).data;
export const startCurrentTenantSubscriptionRenewal = async (data: unknown) => (await api.post("/subscriptions/current/renewal", data)).data;
export const startCurrentTenantSubscriptionActivation = async (data: unknown) => (await api.post("/subscriptions/current/activation", data)).data;
export const previewCurrentTenantSubscriptionCoupon = async (data: unknown) => (await api.post("/subscriptions/current/coupons/preview", data)).data;
export const recordCurrentTenantSubscriptionReminder = async () => (await api.post("/subscriptions/current/reminders/shown")).data;
export const dismissCurrentTenantSubscriptionReminder = async () => (await api.post("/subscriptions/current/reminders/dismiss")).data;
export const syncCurrentTenantSubscriptionCheckout = async (token: string) => (await api.post(`/subscriptions/current/checkout/${token}/sync`)).data;
export const fetchPublicSubscriptionCatalog = async () => (await api.get("/public/subscriptions/catalog")).data;
export const startPublicSubscriptionCheckout = async (data: unknown) => (await api.post("/public/subscriptions/checkout", data)).data;
export const fetchPublicSubscriptionOrder = async (token: string) => (await api.get(`/public/subscriptions/orders/${token}`)).data;
export const fetchSubscriptionAdmin = async (params?: { search?: string }) => (await api.get("/subscriptions/admin", { params })).data;
export const updateSubscriptionAdminPlans = async (data: unknown) => (await api.put("/subscriptions/admin/plans", data)).data;
export const updateSubscriptionAdminPricing = async (data: unknown) => (await api.put("/subscriptions/admin/pricing", data)).data;
export const updateSubscriptionBillingPolicy = async (data: unknown) => (await api.put("/subscriptions/admin/billing-policy", data)).data;
export const createSubscriptionCoupon = async (data: unknown) => (await api.post("/subscriptions/admin/coupons", data)).data;
export const updateSubscriptionCoupon = async (couponId: string, data: unknown) => (await api.put(`/subscriptions/admin/coupons/${couponId}`, data)).data;
export const archiveSubscriptionCoupon = async (couponId: string) => (await api.delete(`/subscriptions/admin/coupons/${couponId}`)).data;
export const assignTenantSubscription = async (tenantId: string, data: unknown) => (await api.put(`/subscriptions/admin/tenants/${tenantId}`, data)).data;

// Demo Request API functions
export type DemoRequestPayload = {
  client_request_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company: string;
  company_size?: string;
  business_type: string;
  requested_modules: string[];
  requested_submodules: string[];
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
    const validationDetails = Object.values(body?.errors ?? {})
      .flatMap((messages) => Array.isArray(messages) ? messages : [])
      .filter((message): message is string => typeof message === "string")
      .join("\n");
    throw new Error(
      validationDetails || (typeof body?.message === "string"
        ? body.message
        : `Failed to submit demo request (${response.status})`),
    );
  }

  return body;
};

export type DemoRequestConfiguration = {
  status?: string;
  notes?: string | null;
  business_type?: string;
  requested_modules?: string[];
  requested_submodules?: string[];
  demo_plan?: string;
  demo_expires_at?: string;
};

export const fetchDemoRequests = async (params?: { status?: string; search?: string; per_page?: number }) =>
  (await api.get("/demo-requests", { params })).data;

export const updateDemoRequest = async (id: number, data: DemoRequestConfiguration) =>
  (await api.put(`/demo-requests/${id}`, data)).data;

export const provisionDemoRequest = async (id: number, data: DemoRequestConfiguration & {
  tenant_id: string;
  tenant_name?: string;
  domain: string;
}) => (await api.post(`/demo-requests/${id}/provision`, data)).data;

export const expireDemoRequest = async (id: number) =>
  (await api.post(`/demo-requests/${id}/expire`)).data;

export default api;
