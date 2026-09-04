"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAccessToken, getBackendApiRoot, getBackendOrigin, getPublicServeUrl, getStoredHiveContextSignature, getTenantHeaders, getTenantId } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import "@/lib/swagger-ui-globals";
import { Activity, Braces, CircleCheckBig, ExternalLink, Home, Layers3, Network, RefreshCcw, Route, ServerCog, ShieldCheck } from "lucide-react";

const SWAGGER_CSS_ID = "swagger-ui-dist-css";
const SWAGGER_BUNDLE_SRC = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js";
const SWAGGER_PRESET_SRC = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js";

type Mode = "central" | "tenant";

type ApiSpec = {
  paths?: Record<string, Record<string, unknown>>;
  tags?: unknown[];
  info?: { version?: string };
  servers?: Array<{ url?: string; description?: string }>;
};

type ApiStats = {
  paths: number;
  operations: number;
  tags: number;
  version: string;
};

type CentralBrandSettings = {
  app_title?: string | null;
  logo_dark?: string | null;
  logo_light?: string | null;
};

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);

function getApiStats(spec: ApiSpec): ApiStats {
  const paths = Object.values(spec.paths ?? {});

  return {
    paths: paths.length,
    operations: paths.reduce(
      (total, methods) => total + Object.keys(methods).filter((method) => HTTP_METHODS.has(method.toLowerCase())).length,
      0,
    ),
    tags: Array.isArray(spec.tags) ? spec.tags.length : 0,
    version: spec.info?.version || "Live",
  };
}

function ensureSwaggerCss() {
  if (document.getElementById(SWAGGER_CSS_ID)) return;
  const link = document.createElement("link");
  link.id = SWAGGER_CSS_ID;
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css";
  document.head.appendChild(link);
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.body.appendChild(script);
  });
}

export default function ApiDocsPage() {
  const swaggerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("central");
  const [token, setToken] = useState("");
  const [tenant, setTenant] = useState("");
  const [tenantSignature, setTenantSignature] = useState("");
  const [status, setStatus] = useState("Loading API command deck...");
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [logoFailed, setLogoFailed] = useState(false);
  const requestConfigRef = useRef({ mode, token, tenant, tenantSignature });

  const backendOrigin = useMemo(() => getBackendOrigin(), []);
  const specUrl = `${backendOrigin}/api/docs/openapi.json`;
  const backendDocsUrl = `${backendOrigin}/api/docs`;
  const rawSpecUrl = `${backendOrigin}/api/docs/openapi.json`;
  const { data: centralBrandResponse } = useQuery<{ data?: CentralBrandSettings }>({
    queryKey: ["centralBrandSettings", "api-docs"],
    queryFn: async () => {
      const response = await fetch(`${getBackendApiRoot()}/settings/brand/public`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) throw new Error("Failed to load central brand settings");
      return response.json();
    },
    staleTime: 600000,
    retry: 1,
  });
  const centralBrand = centralBrandResponse?.data;
  const brandName = centralBrand?.app_title?.trim() || "Hive.OS";
  const logoUrl = getPublicServeUrl(centralBrand?.logo_dark || centralBrand?.logo_light);

  useEffect(() => {
    requestConfigRef.current = { mode, token, tenant, tenantSignature };
  }, [mode, tenant, tenantSignature, token]);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  useEffect(() => {
    ensureSwaggerCss();
    loadScript(SWAGGER_BUNDLE_SRC)
      .then(() => loadScript(SWAGGER_PRESET_SRC))
      .then(() => setReady(true))
      .catch((error) => setStatus(error instanceof Error ? error.message : "Swagger assets could not be loaded. Open the raw specification instead."));
  }, []);

  useEffect(() => {
    const savedToken = getAccessToken() || "";
    const savedTenant = getTenantId() || "";
    const savedTenantSignature = getStoredHiveContextSignature() || "";
    const savedMode = savedTenant ? "tenant" : "central";

    setToken(savedToken);
    setTenant(savedTenant);
    setTenantSignature(savedTenantSignature);
    setMode(savedMode);
    setStatus(savedMode === "tenant"
      ? `Tenant mode ready. Requests will use signed tenant headers for ${savedTenant || "[empty]"}.`
      : "Central mode ready. Requests will target shared /api/v1 endpoints.");
  }, []);

  useEffect(() => {
    if (!ready || !swaggerRef.current || !window.SwaggerUIBundle) {
      return;
    }

    let cancelled = false;

    const mountSwagger = async () => {
      setStatus((current) => current.startsWith("Loading") ? current : "Refreshing API command deck...");

      try {
        const response = await fetch(specUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load spec (${response.status})`);
        }

        const spec = await response.json() as ApiSpec;
        const nextStats = getApiStats(spec);
        spec.servers = [{
          url: `${backendOrigin}/api`,
          description: mode === "tenant"
            ? "Tenant testing root. Use signed tenant headers or tenant aliases below."
            : "Central testing root.",
        }];

        if (cancelled) return;
        if (!swaggerRef.current) return;

        const swaggerBundle = window.SwaggerUIBundle;
        const swaggerPreset = window.SwaggerUIStandalonePreset;
        if (!swaggerBundle || !swaggerPreset) return;

        swaggerRef.current.innerHTML = "";
        window.hiveSwaggerUi = swaggerBundle({
          spec,
          domNode: swaggerRef.current,
          deepLinking: true,
          docExpansion: "list",
          filter: true,
          displayRequestDuration: true,
          tryItOutEnabled: true,
          presets: [
            swaggerBundle.presets.apis,
            swaggerPreset,
          ],
          layout: "BaseLayout",
          requestInterceptor: (request: { headers?: Record<string, string> }) => {
            request.headers = request.headers || {};
            const currentRequestConfig = requestConfigRef.current;

            if (currentRequestConfig.token) {
              request.headers.Authorization = `Bearer ${currentRequestConfig.token}`;
            } else {
              delete request.headers.Authorization;
            }

            const tenantHeaders = currentRequestConfig.mode === "tenant"
              ? getTenantHeaders({
                  tenantOverride: currentRequestConfig.tenant || null,
                  signatureOverride: currentRequestConfig.tenantSignature || null,
                  allowUnsigned: !currentRequestConfig.token,
                })
              : {};

            if (tenantHeaders["X-Tenant"]) {
              request.headers["X-Tenant"] = tenantHeaders["X-Tenant"];
            } else {
              delete request.headers["X-Tenant"];
            }

            if (tenantHeaders["X-Tenant-Signature"]) {
              request.headers["X-Tenant-Signature"] = tenantHeaders["X-Tenant-Signature"];
            } else {
              delete request.headers["X-Tenant-Signature"];
            }

            return request;
          },
        });

        setStats(nextStats);
        setStatus(mode === "tenant"
          ? `${nextStats.operations.toLocaleString()} operations loaded. Tenant requests will include signed headers for ${tenant || "[empty]"}.`
          : `${nextStats.operations.toLocaleString()} operations loaded from the live Laravel route table.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to load the OpenAPI spec.");
      }
    };

    mountSwagger();

    return () => {
      cancelled = true;
      if (window.hiveSwaggerUi?.destroy) {
        window.hiveSwaggerUi.destroy();
      }
      window.hiveSwaggerUi = null;
    };
  }, [backendOrigin, mode, ready, refreshKey, specUrl, tenant]);

  const applySessionDefaults = () => {
    const savedToken = getAccessToken() || "";
    const savedTenant = getTenantId() || "";
    const savedTenantSignature = getStoredHiveContextSignature() || "";
    setToken(savedToken);
    setTenant(savedTenant);
    setTenantSignature(savedTenantSignature);
    setMode(savedTenant ? "tenant" : "central");
    setStatus("Saved session values loaded. They will be applied to every Try it out request.");
  };

  const clearAuthorization = () => {
    setToken("");
    setTenant("");
    setTenantSignature("");
    setMode("central");
    setStatus("Request credentials cleared. Swagger will send no authorization or tenant headers.");
  };

  const refreshDocumentation = () => {
    setStatus("Refreshing the live Laravel route inventory...");
    setRefreshKey((current) => current + 1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex w-full justify-end">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/", icon: <Home className="h-4 w-4" /> },
            { label: "API Docs" },
          ]}
        />
      </div>

      <section aria-labelledby="api-docs-title" className="relative overflow-hidden rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(74,222,128,0.14),transparent_24%),linear-gradient(145deg,rgba(6,18,35,0.98),rgba(13,31,55,0.92))] p-6 text-slate-50 shadow-2xl shadow-slate-950/30 md:p-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle,rgba(250,204,21,0.12),transparent_68%)]" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sky-200/50 bg-white/10 p-1.5 shadow-lg shadow-slate-950/20">
                {logoUrl && !logoFailed ? (
                  <img
                    src={logoUrl}
                    alt={`${brandName} logo`}
                    className="h-full w-full object-contain"
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span aria-hidden="true" className="text-lg font-black text-white">H</span>
                )}
              </div>
              <span className="truncate text-sm font-bold tracking-tight text-white">{brandName}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100">
              <Braces className="h-3.5 w-3.5" /> Interactive Command Deck
            </div>
          </div>
          <div className="max-w-4xl space-y-3">
            <h1 id="api-docs-title" className="max-w-4xl text-4xl font-black tracking-tight md:text-6xl">The live command console for every Hive API.</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Route-derived documentation stays aligned with the running Laravel application. Use the same session context as the dashboard, switch scopes deliberately, and test without leaving your work.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InventoryStat icon={<Route className="h-4 w-4" />} label="Operations" value={stats ? stats.operations.toLocaleString() : "…"} />
            <InventoryStat icon={<Layers3 className="h-4 w-4" />} label="Paths" value={stats ? stats.paths.toLocaleString() : "…"} />
            <InventoryStat icon={<Activity className="h-4 w-4" />} label="Service groups" value={stats ? stats.tags.toLocaleString() : "…"} />
            <InventoryStat icon={<CircleCheckBig className="h-4 w-4" />} label="Spec version" value={stats?.version || "Live"} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard icon={<ServerCog className="h-5 w-5 text-sky-300" />} title="Central mode" body="Use the shared /api/v1 endpoints with no tenant header for control-plane requests." />
            <FeatureCard icon={<Network className="h-5 w-5 text-emerald-300" />} title="Tenant mode" body="Inject signed tenant headers for shared requests or call /v1/tenant aliases directly." />
            <FeatureCard icon={<ShieldCheck className="h-5 w-5 text-amber-300" />} title="Fast authorization" body="Paste a bearer token once or pull it from local storage, then Try it out immediately." />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_2fr]">
        <Card className="border-sky-400/15 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>Request Controls</CardTitle>
            <CardDescription>
              These values are applied to every Swagger request below. The built-in Swagger Authorize button is optional on this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Request scope</legend>
              <Button
                type="button"
                onClick={() => setMode("central")}
                aria-pressed={mode === "central"}
                className={cn("rounded-full", mode === "central" ? "bg-sky-600 text-white hover:bg-sky-700" : "")}
                variant={mode === "central" ? "default" : "outline"}
              >
                Central
              </Button>
              <Button
                type="button"
                onClick={() => setMode("tenant")}
                aria-pressed={mode === "tenant"}
                className={cn("rounded-full", mode === "tenant" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "")}
                variant={mode === "tenant" ? "default" : "outline"}
              >
                Tenant
              </Button>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="api-docs-bearer-token" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Bearer Token</label>
              <Input id="api-docs-bearer-token" autoComplete="off" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste Sanctum token" aria-describedby="api-docs-bearer-help" />
              <p id="api-docs-bearer-help" className="text-xs leading-5 text-muted-foreground">Used only in this page&apos;s Try it out requests.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="api-docs-tenant" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">X-Tenant Header</label>
              <Input id="api-docs-tenant" autoComplete="off" value={tenant} onChange={(event) => setTenant(event.target.value)} placeholder="tenantapple" aria-describedby="api-docs-tenant-help" />
              <p id="api-docs-tenant-help" className="text-xs leading-5 text-muted-foreground">Required only for tenant-scoped calls on a shared host.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="api-docs-tenant-signature" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">X-Tenant-Signature</label>
              <Input id="api-docs-tenant-signature" autoComplete="off" value={tenantSignature} onChange={(event) => setTenantSignature(event.target.value)} placeholder="Signed tenant context" aria-describedby="api-docs-tenant-signature-help" />
              <p id="api-docs-tenant-signature-help" className="text-xs leading-5 text-muted-foreground">Preserves a signed tenant context when your deployment requires it.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={applySessionDefaults} className="rounded-full">
                <RefreshCcw className="h-4 w-4" /> Use Saved Session
              </Button>
              <Button type="button" onClick={clearAuthorization} variant="outline" className="rounded-full">
                Clear
              </Button>
              <Button type="button" onClick={refreshDocumentation} variant="outline" className="rounded-full">
                <RefreshCcw className="h-4 w-4" /> Refresh endpoints
              </Button>
            </div>

            <div role="status" aria-atomic="true" className="rounded-2xl border border-sky-400/10 bg-sky-400/5 p-4 text-sm leading-6 text-muted-foreground">
              {status}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <QuickLink href={backendDocsUrl} label="Open Backend Docs" helper="Direct backend UI at /api/docs" />
              <QuickLink href={rawSpecUrl} label="Open Raw Spec" helper="Machine-readable OpenAPI JSON" />
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="live-reference-heading" className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-xl shadow-slate-950/10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <div>
              <h2 id="live-reference-heading" className="inline font-semibold">Live reference:</h2>{" "}
              <code className="rounded bg-slate-200 px-2 py-1 font-mono text-xs">{backendOrigin}/api</code>
            </div>
            <div className="text-xs text-slate-500">Swagger requests inherit the mode, token, and tenant values from the controls.</div>
          </div>
          <div className="swagger-surface min-h-[900px] p-3 md:p-4">
            <div ref={swaggerRef} />
          </div>
        </section>
      </div>

      <style jsx global>{`
        .swagger-surface .swagger-ui .topbar { display: none; }
        .swagger-surface .swagger-ui { font-family: var(--font-mono), ui-monospace, monospace; }
        .swagger-surface .swagger-ui .scheme-container {
          background: linear-gradient(180deg, #f8fbff 0%, #eff8ff 100%);
          border: 1px solid rgba(14, 165, 233, 0.12);
          border-radius: 18px;
          box-shadow: none;
          padding: 18px;
        }
        .swagger-surface .swagger-ui .opblock {
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
        }
        .swagger-surface .swagger-ui .opblock .opblock-summary-method {
          border-radius: 12px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-weight: 600;
        }
        .swagger-surface .swagger-ui .btn.execute {
          background: #0f766e;
          border-color: #0f766e;
        }
        .swagger-surface .swagger-ui button:focus-visible,
        .swagger-surface .swagger-ui a:focus-visible,
        .swagger-surface .swagger-ui input:focus-visible,
        .swagger-surface .swagger-ui select:focus-visible,
        .swagger-surface .swagger-ui textarea:focus-visible {
          outline: 3px solid #0f766e;
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .swagger-surface .swagger-ui *,
          .swagger-surface .swagger-ui *::before,
          .swagger-surface .swagger-ui *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
        {icon}
      </div>
      <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.18em] text-slate-100">{title}</h3>
      <p className="text-sm leading-6 text-slate-300">{body}</p>
    </div>
  );
}

function InventoryStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3 backdrop-blur-sm">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-sky-100">{icon}</span>
      <div className="min-w-0">
        <div className="text-xl font-black tabular-nums text-white">{value}</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</div>
      </div>
    </div>
  );
}

function QuickLink({ href, label, helper }: { href: string; label: string; helper: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group rounded-2xl border border-border/60 bg-background/70 p-4 transition hover:border-sky-400/40 hover:bg-sky-50/40"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground transition group-hover:text-sky-600" />
      </div>
    </a>
  );
}



