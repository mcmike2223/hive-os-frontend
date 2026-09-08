import axios from "axios";
import { clearHiveSession } from "@/lib/auth-sync";
import { getEchoSocketId } from "@/lib/echo";
import { getAccessToken, getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";

// Derived from the router: these are the only first path segments served
// exclusively by Route::domain(<central domain>) groups. "tenant" (singular) is
// deliberately absent - those routes are tenant-scoped - so the segment is
// compared exactly rather than by prefix.
const CENTRAL_ONLY_SEGMENTS = new Set([
  "tenants",
  "check-tenant",
  "realtime",
  "test-export-logo",
]);

const isCentralOnlyEndpoint = (url?: string): boolean => {
  if (!url) return false;

  const path = url.split("?")[0].replace(/^\/+/, "");
  const segment = path.replace(/^api\/v1\//, "").split("/")[0];

  return CENTRAL_ONLY_SEGMENTS.has(segment);
};

export const api = axios.create({
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const backendUrl = getBackendApiRoot();

    if (config.url && config.url.startsWith('/api/v1')) {
      config.url = config.url.replace(/^\/api\/v1/, '');
    }

    config.baseURL = backendUrl;

    // Central command endpoints are registered only against the central domain:
    // they read the central database and authenticate against the central token
    // table. Sending tenant context at them makes an impersonating admin's own
    // token stop resolving, which the response interceptor below reads as a dead
    // session and ejects to sign-in. Every other endpoint is registered on both
    // the central domain and the tenant catch-all, so it must keep the header.
    if (!isCentralOnlyEndpoint(config.url)) {
      Object.assign(config.headers, getTenantHeaders());
    }

    // Laravel's `toOthers()` contract depends on this header. Supplying the
    // active Reverb socket prevents the initiating tab from applying its own
    // optimistic mailbox mutation twice, while other tabs still receive it.
    const socketId = getEchoSocketId();
    if (socketId) config.headers["X-Socket-ID"] = socketId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      const status = error.response?.status;
      const msg = error.response?.data?.message || "";
      const code = String(error.response?.data?.code || "");
      const requestUrl = String(error.config?.url || "");

      const isUnauthorized = status === 401;
      const isEjected = status === 403 && msg.includes("CRITICAL:");
      const isTelemetryRequest = requestUrl.includes("/logs/client-action");

      // The backend blocks every route until a first-login password is
      // replaced. It cannot redirect, being an API, so it answers with this
      // code and the routing happens here. Handled before the sign-out paths
      // below: the session is valid, it is just not allowed anywhere yet.
      if (status === 403 && code === "PASSWORD_CHANGE_REQUIRED") {
        const onChangePassword = window.location.pathname.includes("/change-password");

        if (!onChangePassword) {
          // Remembered so the form can return the user where they were going,
          // rather than dumping everyone on the dashboard root.
          sessionStorage.setItem(
            "hive_password_change_intended",
            window.location.pathname + window.location.search,
          );
          window.location.href = "/change-password";
        }

        return Promise.reject(error);
      }

      const isSubscriptionLock = status === 402 && [
        "TENANT_SUBSCRIPTION_ACTIVATION_REQUIRED",
        "TENANT_SUBSCRIPTION_NOT_ACTIVE",
      ].includes(code);
      const isBillingRequest = requestUrl.includes("/subscriptions");

      if (isSubscriptionLock && !isBillingRequest && !window.location.pathname.startsWith("/dashboard/subscriptions")) {
        sessionStorage.setItem(
          "hive_billing_locked_from",
          window.location.pathname + window.location.search,
        );
        window.location.href = "/dashboard/subscriptions";
        return Promise.reject(error);
      }

      if ((isUnauthorized && !isTelemetryRequest) || isEjected) {
        const ejectReason = code === "TENANT_CONTEXT_INVALID"
          || code === "TENANT_CONTEXT_SIGNATURE_INVALID"
          || code === "SESSION_EXPIRED"
          ? msg
          : undefined;

        clearHiveSession(ejectReason);

        if (isEjected) {
          sessionStorage.setItem("hive_eject_reason", msg.replace("CRITICAL: ", ""));
        }

        if (!window.location.pathname.includes("/sign-in")) {
          window.location.href = "/sign-in";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
