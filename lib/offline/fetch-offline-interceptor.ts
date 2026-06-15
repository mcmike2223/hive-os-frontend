"use client";

import {
  enqueueOfflineRequest,
  isOfflineManagedRequestInFlight,
  type OfflineQueueResult,
} from "@/lib/offline/mutation-queue";
import { getRequestLabel } from "@/lib/offline/url-invalidation";

/**
 * Mirrors the axios offline interceptor, but for the large number of ERP
 * modules that call the backend with the native `fetch` API (via
 * getBackendApiRoot()) instead of the shared axios instance. Without this,
 * those writes would be silently lost while offline.
 *
 * Behaviour: a mutating request to the backend API that fails with a network
 * error (i.e. we are offline / server unreachable) is queued and answered with
 * a synthetic 202 so callers treat it as accepted. The queue processor replays
 * it through axios when connectivity returns.
 */

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Only these request headers are persisted with a queued item. Auth + tenant
// headers are re-applied fresh by the axios request interceptor at flush time.
const SAFE_HEADER_KEYS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "x-tenant-id",
  "x-tenant-context",
  "x-tenant-signature",
  "x-requested-with",
]);

// Never queue these (telemetry / fire-and-forget) — they would only bloat the queue.
const SKIP_PATH_HINTS = ["/logs/client-action"];

let originalFetch: typeof window.fetch | null = null;
let isInstalled = false;

const isBrowser = (): boolean => typeof window !== "undefined";

const isApiPath = (pathname: string): boolean => pathname.includes("/api/v1");

const isNetworkError = (error: unknown): boolean => {
  // The browser throws a TypeError ("Failed to fetch" / "Load failed") when a
  // request never reaches the server. An AbortError is a DOMException, not a
  // TypeError, so genuine aborts are correctly excluded.
  if (error instanceof TypeError) return true;
  return Boolean(error && typeof error === "object" && (error as { name?: string }).name === "TypeError");
};

const resolveMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== "string" && !(input instanceof URL)) {
    return ((input as Request).method || "GET").toUpperCase();
  }
  return "GET";
};

const resolveUrl = (input: RequestInfo | URL): string => {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;
  return new URL(raw, window.location.origin).href;
};

const shouldSkip = (input: RequestInfo | URL, init?: RequestInit): boolean => {
  const headerBag = init?.headers ?? (typeof input !== "string" && !(input instanceof URL) ? (input as Request).headers : undefined);
  if (headerBag) {
    try {
      const headers = new Headers(headerBag);
      if (headers.get("x-skip-offline-queue") === "1") return true;
    } catch {
      /* ignore malformed header bags */
    }
  }
  return false;
};

const extractHeaders = (input: RequestInfo | URL, init?: RequestInit): Record<string, string> => {
  const out: Record<string, string> = {};
  const headerBag = init?.headers ?? (typeof input !== "string" && !(input instanceof URL) ? (input as Request).headers : undefined);
  if (!headerBag) return out;
  try {
    new Headers(headerBag).forEach((value, key) => {
      if (SAFE_HEADER_KEYS.has(key.toLowerCase()) && value != null) {
        out[key] = value;
      }
    });
  } catch {
    /* ignore */
  }
  return out;
};

/**
 * Returns a JSON-serialisable body, or { serializable: false } when the body
 * cannot be safely persisted (e.g. FormData / Blob uploads). Such requests are
 * never queued — we let the original failure surface instead.
 */
const extractSerializableBody = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ serializable: boolean; data: unknown }> => {
  let body: BodyInit | null | undefined = init?.body;

  if (body == null && typeof input !== "string" && !(input instanceof URL)) {
    const req = input as Request;
    if (req.body) {
      try {
        body = await req.clone().text();
      } catch {
        return { serializable: false, data: null };
      }
    }
  }

  if (body == null) return { serializable: true, data: undefined };
  if (typeof body !== "string") {
    // FormData, Blob, ArrayBuffer, URLSearchParams, ReadableStream — not persisted.
    return { serializable: false, data: null };
  }

  try {
    return { serializable: true, data: JSON.parse(body) };
  } catch {
    return { serializable: true, data: body };
  }
};

const buildQueuedResponse = (queueId: string, label: string): Response =>
  new Response(
    JSON.stringify({ __offlineQueued: true, queueId, label, queuedAt: new Date().toISOString() }),
    {
      status: 202,
      statusText: "Accepted (Queued for offline sync)",
      headers: { "Content-Type": "application/json" },
    },
  );

export const installFetchOfflineInterceptor = (): void => {
  if (!isBrowser() || isInstalled) return;
  originalFetch = window.fetch.bind(window);
  isInstalled = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const orig = originalFetch!;

    // Cheap eligibility gate — bail to the native fetch as fast as possible.
    let method: string;
    let url: string;
    let pathname: string;
    try {
      method = resolveMethod(input, init);
      if (!MUTATING_METHODS.has(method)) return orig(input, init);
      if (isOfflineManagedRequestInFlight()) return orig(input, init);
      url = resolveUrl(input);
      pathname = new URL(url).pathname;
      if (!isApiPath(pathname)) return orig(input, init);
      if (SKIP_PATH_HINTS.some((hint) => pathname.includes(hint))) return orig(input, init);
      if (shouldSkip(input, init)) return orig(input, init);
    } catch {
      return orig(input, init);
    }

    const body = await extractSerializableBody(input, init);
    if (!body.serializable) {
      return orig(input, init);
    }

    try {
      return await orig(input, init);
    } catch (error) {
      if (!isNetworkError(error)) throw error;

      const label = getRequestLabel(method, url);
      const queued = enqueueOfflineRequest({
        method,
        url,
        data: body.data,
        params: null,
        headers: extractHeaders(input, init),
        label,
      });

      window.dispatchEvent(
        new CustomEvent<OfflineQueueResult>("hive_offline_queue_result", {
          detail: { type: "queued", id: queued.queueId, label, url },
        }),
      );

      return buildQueuedResponse(queued.queueId, label);
    }
  };
};

export const uninstallFetchOfflineInterceptor = (): void => {
  if (!isBrowser() || !isInstalled || !originalFetch) return;
  window.fetch = originalFetch;
  originalFetch = null;
  isInstalled = false;
};
