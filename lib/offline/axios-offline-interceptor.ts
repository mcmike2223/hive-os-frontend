"use client";

import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import {
  enqueueOfflineRequest,
  isOfflineManagedRequestInFlight,
  type OfflineQueueResult,
} from "@/lib/offline/mutation-queue";
import { getRequestLabel } from "@/lib/offline/url-invalidation";

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

// x-idempotency-key MUST be persisted here for the same reason as in the fetch
// interceptor: it identifies the submission, not the session, so nothing can
// re-derive it at flush time, and replaying a committed write without it
// duplicates that write. Keep the two allowlists in step.
const SAFE_HEADER_KEYS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "x-idempotency-key",
  "x-tenant-id",
  "x-tenant-context",
  "x-tenant-signature",
  "x-requested-with",
]);

const isBrowser = (): boolean => typeof window !== "undefined";

let interceptorId: number | null = null;
let isInstalled = false;

const shouldSkipQueue = (config: InternalAxiosRequestConfig): boolean => {
  const raw = config as InternalAxiosRequestConfig & { skipOfflineQueue?: boolean };
  if (raw.skipOfflineQueue === true) return true;
  if (raw.headers && typeof raw.headers === "object") {
    const headers = raw.headers as Record<string, string>;
    if (headers["x-skip-offline-queue"] === "1") return true;
  }
  return false;
};

const buildQueuedResponse = (
  config: InternalAxiosRequestConfig,
  queueId: string,
  label: string,
): AxiosResponse<{ __offlineQueued: true; queueId: string; label: string; queuedAt: string }> => {
  return {
    data: {
      __offlineQueued: true,
      queueId,
      label,
      queuedAt: new Date().toISOString(),
    },
    status: 202,
    statusText: "Accepted (Queued for offline sync)",
    headers: {},
    config,
  };
};

const sanitizeHeaders = (
  config: InternalAxiosRequestConfig,
): Record<string, string> => {
  const out: Record<string, string> = {};
  const headers = (config.headers ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (!SAFE_HEADER_KEYS.has(lower)) continue;
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
};

const looksLikeNetworkError = (error: AxiosError): boolean => {
  if (!error) return false;
  if ((error as AxiosError & { code?: string }).code === "ERR_NETWORK") return true;
  if (!error.response) return true;
  const status = error.response.status;
  return status === 0;
};

const deriveUrl = (config: InternalAxiosRequestConfig): string => {
  if (config.baseURL && config.url && !/^https?:\/\//i.test(config.url)) {
    const base = config.baseURL.endsWith("/") ? config.baseURL.slice(0, -1) : config.baseURL;
    const path = config.url.startsWith("/") ? config.url : `/${config.url}`;
    return `${base}${path}`;
  }
  return config.url ?? "";
};

export const installAxiosOfflineInterceptor = (): void => {
  if (!isBrowser() || isInstalled) return;
  isInstalled = true;

  void import("@/modules/shared/api/http").then(({ default: api }) => {
    if (interceptorId !== null) return;
    interceptorId = api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (!isBrowser()) {
          return Promise.reject(error);
        }

        const config = error.config as InternalAxiosRequestConfig | undefined;
        if (!config) {
          return Promise.reject(error);
        }

        if (shouldSkipQueue(config)) {
          return Promise.reject(error);
        }

        if (isOfflineManagedRequestInFlight()) {
          return Promise.reject(error);
        }

        const method = (config.method ?? "get").toLowerCase();
        if (!MUTATING_METHODS.has(method)) {
          return Promise.reject(error);
        }

        if (!looksLikeNetworkError(error)) {
          return Promise.reject(error);
        }

        const url = deriveUrl(config);
        if (!url) {
          return Promise.reject(error);
        }

        const label = getRequestLabel(method, url);
        const queued = enqueueOfflineRequest({
          method,
          url,
          data: config.data,
          params: config.params,
          headers: sanitizeHeaders(config),
          label,
        });

        if (typeof window !== "undefined") {
          const event = new CustomEvent<OfflineQueueResult>("hive_offline_queue_result", {
            detail: {
              type: "queued",
              id: queued.queueId,
              label,
              url,
            },
          });
          window.dispatchEvent(event);
        }

        return Promise.resolve(buildQueuedResponse(config, queued.queueId, label));
      },
    );
  });
};

export const uninstallAxiosOfflineInterceptor = (): void => {
  if (!isBrowser() || interceptorId === null) return;
  void import("@/modules/shared/api/http").then(({ default: api }) => {
    if (interceptorId !== null) {
      api.interceptors.response.eject(interceptorId);
      interceptorId = null;
    }
  }).catch(() => {
    interceptorId = null;
  });
  isInstalled = false;
};
