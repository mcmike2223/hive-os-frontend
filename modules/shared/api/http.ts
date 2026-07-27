import axios from "axios";
import { clearHiveSession } from "@/lib/auth-sync";
import { getAccessToken, getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";

export const api = axios.create({
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Use relative URLs for public routes (CORS-free via Next.js rewrites)
    // For tenant routes, let the runtime-context handle the baseURL
    const backendUrl = getBackendApiRoot();

    // Public routes like /api/v1/public/* should use relative URLs
    if (backendUrl && config.url && !config.url.startsWith('/api/v1/public') && !config.url.startsWith('/api/v1')) {
      config.baseURL = backendUrl;
    } else if (config.url && config.url.startsWith('/api/v1')) {
      config.baseURL = undefined;
    }

    Object.assign(config.headers, getTenantHeaders());
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
