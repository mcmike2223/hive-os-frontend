const HIVE_CONTEXT_KEY = "hive_context";
const HIVE_CONTEXT_SIGNATURE_KEY = "hive_context_signature";
const SIGNED_STREAM_REFRESH_BUFFER_SECONDS = 30;

type SignedStreamCacheEntry = {
  url: string;
  expiresAt: number;
};

const signedStreamCache = new Map<string, SignedStreamCacheEntry>();

export const getStoredHiveContext = (): string | null => {
  if (typeof window === "undefined") return null;

  const value = localStorage.getItem(HIVE_CONTEXT_KEY);

  if (!value || value === "undefined" || value === "null") {
    return null;
  }

  return value;
};

export const getStoredHiveContextSignature = (): string | null => {
  if (typeof window === "undefined") return null;

  const value = localStorage.getItem(HIVE_CONTEXT_SIGNATURE_KEY);

  if (!value || value === "undefined" || value === "null") {
    return null;
  }

  return value;
};

export const persistHiveContext = (
  context: string | null,
  signature?: string | null,
) => {
  if (typeof window === "undefined") return;

  if (context) {
    localStorage.setItem(HIVE_CONTEXT_KEY, context);
  } else {
    localStorage.removeItem(HIVE_CONTEXT_KEY);
  }

  if (signature) {
    localStorage.setItem(HIVE_CONTEXT_SIGNATURE_KEY, signature);
  } else {
    localStorage.removeItem(HIVE_CONTEXT_SIGNATURE_KEY);
  }
};

const normalizeHost = (value: string | null | undefined): string | null => {
  if (!value) return null;

  return (
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .replace(/\.+$/, "") || null
  );
};

const extractConfiguredHost = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizeHost(value);

  if (!normalized) {
    return null;
  }

  try {
    return normalizeHost(new URL(value as string).hostname);
  } catch {
    return normalized;
  }
};

export const getCentralHosts = (): string[] => {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "gulfingot.com";

  const configuredHosts = [
    rootDomain,
    `hive.${rootDomain}`,
    `hive-backend.${rootDomain}`,
    `hive-queue.${rootDomain}`,
    extractConfiguredHost(process.env.NEXT_PUBLIC_APP_URL),
    extractConfiguredHost(process.env.NEXT_PUBLIC_API_URL),
    ...(process.env.NEXT_PUBLIC_CENTRAL_DOMAINS?.split(",") ?? []).map(
      (value) => normalizeHost(value),
    ),
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(["localhost", "127.0.0.1", ...configuredHosts]));
};

export const isCentralHost = (host: string): boolean => {
  const normalized = normalizeHost(host);

  if (!normalized) {
    return true;
  }

  return getCentralHosts().includes(normalized);
};

export const isTenantHost = (host: string): boolean => {
  return !isCentralHost(host);
};

export const isTenantSession = (): boolean => {
  if (typeof window === "undefined") return false;

  if (isTenantHost(window.location.hostname)) {
    return true;
  }

  const context = getStoredHiveContext();
  if (context) {
    return context !== "central";
  }

  return false;
};

export const getTenantId = (): string | null => {
  if (typeof window === "undefined") return null;

  const context = getStoredHiveContext();
  if (context && context !== "central") {
    return context;
  }

  const host = window.location.hostname.toLowerCase();

  // 1. Handle localhost subdomains
  if (host.endsWith(".localhost")) {
    return host.split(".")[0] || null;
  }

  // 2. Handle production subdomains
  if (isTenantHost(host)) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "gulfingot.com";
    if (host.endsWith(`.${rootDomain}`)) {
      return host.replace(`.${rootDomain}`, "");
    }
    return normalizeHost(host);
  }

  return null;
};

export const getWorkspaceScopeKey = (): string => {
  if (typeof window === "undefined") {
    return "server";
  }

  const host = normalizeHost(window.location.hostname) ?? "unknown-host";
  const tenantId = getTenantId();

  if (tenantId) {
    return `tenant:${tenantId}@${host}`;
  }

  return `central:${host}`;
};

export const getAppOrigin = (): string => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }

  return window.location.origin;
};

const shouldUseSameOriginTenantBackend = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const host = normalizeHost(window.location.hostname);

  if (!host || !isTenantHost(host)) {
    return false;
  }

  return !host.endsWith(".localhost");
};

const normalizeApiRoot = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return trimmed;
  }

  const normalizePath = (path: string): string => {
    const cleanPath = path.replace(/\/+$/, "");

    if (!cleanPath || cleanPath === "/") {
      return "/api/v1";
    }

    if (/\/api\/v1$/i.test(cleanPath)) {
      return cleanPath;
    }

    if (/\/api$/i.test(cleanPath)) {
      return `${cleanPath}/v1`;
    }

    return `${cleanPath}/api/v1`;
  };

  try {
    const url = new URL(trimmed);
    url.pathname = normalizePath(url.pathname);
    return url.toString().replace(/\/+$/, "");
  } catch {
    return normalizePath(trimmed);
  }
};

export const getBackendOrigin = (): string => {
  const configuredApiRoot = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredApiRoot && configuredApiRoot.startsWith("http")) {
    try {
      const url = new URL(configuredApiRoot);
      const onTenantHost =
        typeof window !== "undefined" && isTenantHost(window.location.hostname);
      if (onTenantHost) {
        const protocol = window.location.protocol;
        const host = window.location.hostname;
        const port = url.port ? `:${url.port}` : "";
        return `${protocol}//${host}${port}`;
      }
      return url.origin;
    } catch {
      // Fallback
    }
  }

  if (shouldUseSameOriginTenantBackend()) {
    return window.location.origin.replace(/\/+$/, "");
  }

  if (typeof window === "undefined") {
    return "http://localhost:8085";
  }

  const host = window.location.hostname;
  const protocol = window.location.protocol;

  return `${protocol}//${host}`;
};

export const getBackendApiRoot = (): string => {
  if (shouldUseSameOriginTenantBackend()) {
    return `${window.location.origin.replace(/\/+$/, "")}/api/v1`;
  }

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const onTenantHost =
    typeof window !== "undefined" && isTenantHost(window.location.hostname);

  if (configured && onTenantHost) {
    try {
      const url = new URL(configured);
      url.protocol = window.location.protocol;
      url.hostname = window.location.hostname;
      return normalizeApiRoot(url.toString());
    } catch {
      // Fallback
    }
  }

  if (configured) {
    return normalizeApiRoot(configured);
  }

  return `${getBackendOrigin()}/api/v1`;
};

const getLocalPathname = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

/**
 * Legacy synchronous media URL adapter used by viewers that cannot await a
 * signed URL. Reusable audio/video players should use
 * getSignedMediaStreamUrl so the bearer token never enters the media URL.
 */
export const getStreamUrl = (url: string | null | undefined): string => {
  if (!url) return "";

  // Only transform URLs that follow the /api/v1/files/{id}/serve pattern
  const match = url.match(/\/api\/v1\/files\/(\d+)\/serve/);
  if (!match) return url;

  const fileId = match[1];
  const apiRoot = getBackendApiRoot();
  const token =
    typeof window !== "undefined" ? localStorage.getItem("hive_token") : null;
  const tenantId = getTenantId();
  const tenantSignature = getStoredHiveContextSignature();

  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (tenantId) params.set("tenant", tenantId);

  // Only add signature for tenant-scoped requests (not central)
  if (tenantId && tenantId !== "central" && tenantSignature) {
    params.set("signature", tenantSignature);
  }

  return `${apiRoot}/media/stream/${fileId}?${params.toString()}`;
};

const extractMediaFileId = (url: string): string | null => {
  const match = url.match(
    /\/api\/v1\/(?:files\/(\d+)\/serve|media\/stream\/(\d+))/,
  );

  return match?.[1] ?? match?.[2] ?? null;
};

const readSignedStreamExpiry = (url: string): number | null => {
  try {
    const expiresAt = Number(new URL(url, getBackendOrigin()).searchParams.get("exp"));
    return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt : null;
  } catch {
    return null;
  }
};

type SignedStreamOptions = {
  forceRefresh?: boolean;
};

/**
 * Exchanges a protected file URL for a short-lived stream URL that native
 * audio/video elements can use without exposing the session bearer token.
 * Public and non-file URLs are returned unchanged.
 */
export const getSignedMediaStreamUrl = async (
  url: string | null | undefined,
  options: SignedStreamOptions = {},
): Promise<string> => {
  if (!url) return "";

  const fileId = extractMediaFileId(url);
  if (!fileId) return url;

  const now = Math.floor(Date.now() / 1000);
  const currentExpiry = readSignedStreamExpiry(url);

  if (
    !options.forceRefresh &&
    currentExpiry !== null &&
    currentExpiry > now + SIGNED_STREAM_REFRESH_BUFFER_SECONDS
  ) {
    return url;
  }

  const cacheKey = `${getWorkspaceScopeKey()}:file:${fileId}`;
  const cached = signedStreamCache.get(cacheKey);
  if (
    !options.forceRefresh &&
    cached &&
    cached.expiresAt > now + SIGNED_STREAM_REFRESH_BUFFER_SECONDS
  ) {
    return cached.url;
  }

  const response = await fetch(
    `${getBackendApiRoot()}/files/${fileId}/signed-stream-url`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error(`Unable to authorize media playback (status ${response.status}).`);
  }

  const payload = (await response.json()) as {
    url?: unknown;
    expires_at?: unknown;
  };
  const signedUrl = typeof payload.url === "string" ? payload.url : "";
  const expiresAt = Number(payload.expires_at);

  if (!signedUrl || !Number.isFinite(expiresAt) || expiresAt <= now) {
    throw new Error("The media server returned an invalid stream authorization.");
  }

  signedStreamCache.set(cacheKey, { url: signedUrl, expiresAt });

  return signedUrl;
};

const getStorageAssetPath = (url: string | null | undefined): string | null => {
  if (!url) return null;

  const pathname = getLocalPathname(url).trim();

  if (!pathname) {
    return null;
  }

  const tenantAssetPrefix = "/tenancy/assets/";
  if (pathname.startsWith(tenantAssetPrefix)) {
    return pathname.slice(tenantAssetPrefix.length).replace(/^\/+/, "");
  }

  const storagePrefix = "/storage/";
  const storageIndex = pathname.indexOf(storagePrefix);
  if (storageIndex !== -1) {
    return pathname
      .slice(storageIndex + storagePrefix.length)
      .replace(/^\/+/, "");
  }

  if (pathname.startsWith("storage/")) {
    return pathname.slice("storage/".length).replace(/^\/+/, "");
  }

  // If no prefix but it looks like a relative path (doesn't start with / or http)
  if (!pathname.startsWith("/") && !pathname.startsWith("http")) {
    return pathname;
  }

  return null;
};

type TenantHeaderOptions = {
  allowUnsigned?: boolean;
  tenantOverride?: string | null;
  signatureOverride?: string | null;
};

export const getTenantHeaders = (
  options: TenantHeaderOptions = {},
): Record<string, string> => {
  const tenantId = options.tenantOverride ?? getTenantId();

  if (!tenantId) {
    return {};
  }

  const signature =
    options.signatureOverride ?? getStoredHiveContextSignature();
  const tenantHost =
    typeof window !== "undefined" && isTenantHost(window.location.hostname);

  if (!tenantHost && !signature && !options.allowUnsigned) {
    return {};
  }

  return {
    "X-Tenant": tenantId,
    ...(signature ? { "X-Tenant-Signature": signature } : {}),
  };
};

export const getAuthHeaders = (
  extras: Record<string, string> = {},
): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...getTenantHeaders(),
    ...extras,
  };

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("hive_token");
  if (!token || token === "undefined" || token === "null") {
    return null;
  }
  return token;
};

export const getBackendStorageUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url) return null;

  const assetPath = getStorageAssetPath(url);
  if (assetPath) {
    const onTenantHost =
      typeof window !== "undefined" && isTenantHost(window.location.hostname);
    const basePath =
      onTenantHost || isTenantSession() ? "/tenancy/assets" : "/storage";
    return `${getBackendOrigin()}${basePath}/${assetPath}`;
  }

  if (url.startsWith("http")) {
    return url;
  }

  const normalizedPath = url.startsWith("/") ? url : `/${url}`;
  return `${getBackendOrigin()}${normalizedPath}`;
};

export const getPublicServeUrl = (
  url: string | null | undefined,
): string | null => {
  if (!url) return null;

  // Convert private serve URL to public-serve URL for public pages
  if (
    typeof url === "string" &&
    url.includes("/files/") &&
    url.includes("/serve")
  ) {
    const publicUrl = url.replace("/serve", "/public-serve");
    return getBackendStorageUrl(publicUrl);
  }

  return getBackendStorageUrl(url);
};

export const extractStorageRelativePath = (
  url: string | null | undefined,
): string | null => {
  if (!url) return null;

  const assetPath = getStorageAssetPath(url);
  if (assetPath) {
    return `/storage/${assetPath}`;
  }

  return getLocalPathname(url);
};

export const handleAuthFailureResponse = async (
  res: Response,
): Promise<boolean> => {
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/sign-in";
    }
    return true;
  }
  return false;
};
