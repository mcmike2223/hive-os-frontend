"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAccessToken, getAuthHeaders, getBackendOrigin, getStoredHiveContextSignature, getTenantHeaders, getTenantId } from "@/lib/runtime-context";
import { cn } from "@/lib/utils";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { API_DOCS_ROUTE_PERMISSIONS } from "@/lib/route-permissions";
import { Home, ExternalLink, ShieldCheck, Network, ServerCog, RefreshCcw, Braces, ShieldAlert } from "lucide-react";
import "@/lib/swagger-ui-globals";

const SWAGGER_CSS_ID = "swagger-ui-dist-css";
const SWAGGER_BUNDLE_SRC = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js";
const SWAGGER_PRESET_SRC = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js";

type Mode = "central" | "tenant";

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

const { hasAnyPermission, isLoaded } = usePermissions();
  const canViewApiDocs = hasAnyPermission([...API_DOCS_ROUTE_PERMISSIONS]);

  const backendOrigin = useMemo(() => getBackendOrigin(), []);
  const specUrl = `${backendOrigin}/api/docs/openapi.json`;
  const backendDocsUrl = `${backendOrigin}/api/docs`;
  const rawSpecUrl = `${backendOrigin}/api/docs/openapi.json`;

  useEffect(() => {
    ensureSwaggerCss();
    loadScript(SWAGGER_BUNDLE_SRC)
      .then(() => loadScript(SWAGGER_PRESET_SRC))
      .then(() => setReady(true))
      .catch((error) => setStatus(error instanceof Error ? error.message : "Failed to load Swagger assets."));
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
        const response = await fetch(specUrl, { headers: getAuthHeaders() });
        if (!response.ok) {
          throw new Error(`Failed to load spec (${response.status})`);
        }

        const spec = await response.json();
        spec.servers = [{
          url: `${backendOrigin}/api`,
          description: mode === "tenant"
            ? "Tenant testing root. Use signed tenant headers or tenant aliases below."
            : "Central testing root.",
        }];

        if (cancelled || !swaggerRef.current) return;

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
          requestInterceptor: (request) => {
            request.headers = request.headers || {};

            if (token) {
              request.headers.Authorization = `Bearer ${token}`;
            } else {
              delete request.headers.Authorization;
            }

            const tenantHeaders = mode === "tenant"
              ? getTenantHeaders({
                  tenantOverride: tenant || null,
                  signatureOverride: tenantSignature || null,
                  allowUnsigned: !token,
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

        setStatus(mode === "tenant"
          ? `Tenant mode active. Swagger requests will include signed tenant headers for ${tenant || "[empty]"}.`
          : "Central mode active. Swagger requests will use the shared API root.");
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
  }, [backendOrigin, mode, ready, specUrl, tenant, tenantSignature, token]);

  const applySessionDefaults = () => {
    const savedToken = getAccessToken() || "";
    const savedTenant = getTenantId() || "";
    const savedTenantSignature = getStoredHiveContextSignature() || "";
    setToken(savedToken);
    setTenant(savedTenant);
    setTenantSignature(savedTenantSignature);
    setMode(savedTenant ? "tenant" : "central");
  };

  const clearAuthorization = () => {
    setToken("");
    setTenant("");
    setTenantSignature("");
    setMode("central");
  };

  if (!isLoaded) {
    return <ModulePageSkeleton titleWidth="w-44" subtitleWidth="w-72" rows={4} cols={2} />;
  }

  if (!canViewApiDocs) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-[2rem] border border-border/50 bg-card/40 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">Access Denied</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Your current access token lacks the required <strong className="text-destructive">view_api_docs</strong> capability.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex w-full justify-end">
        <Breadcrumbs
          items={[
            { label: "Hive.OS", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
            { label: "API Docs" },
          ]}
        />
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(74,222,128,0.14),transparent_24%),linear-gradient(145deg,rgba(6,18,35,0.98),rgba(13,31,55,0.92))] p-6 text-slate-50 shadow-2xl shadow-slate-950/30 md:p-8">
        <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle,rgba(250,204,21,0.12),transparent_68%)]" />
        <div className="relative space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100">
            <Braces className="h-3.5 w-3.5" /> Interactive Command Deck
          </div>
          <div className="max-w-4xl space-y-3">
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">Test central and tenant APIs from one polished workspace.</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              This frontend docs page reads your current session, can auto-fill the bearer token stored in <code className="rounded bg-white/10 px-1.5 py-0.5 text-sky-100">hive_token</code>,
              and lets you switch between central and tenant request modes without leaving the dashboard.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard icon={<ServerCog className="h-5 w-5 text-sky-300" />} title="Central mode" body="Use the shared /api/v1 endpoints with no tenant header for control-plane requests." />
            <FeatureCard icon={<Network className="h-5 w-5 text-emerald-300" />} title="Tenant mode" body="Inject signed tenant headers for shared tenant requests or call /v1/tenant aliases directly." />
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setMode("central")}
                className={cn("rounded-full", mode === "central" ? "bg-sky-600 text-white hover:bg-sky-700" : "")}
                variant={mode === "central" ? "default" : "outline"}
              >
                Central
              </Button>
              <Button
                type="button"
                onClick={() => setMode("tenant")}
                className={cn("rounded-full", mode === "tenant" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "")}
                variant={mode === "tenant" ? "default" : "outline"}
              >
                Tenant
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Bearer Token</label>
              <Input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste Sanctum token" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">X-Tenant Header</label>
              <Input value={tenant} onChange={(event) => setTenant(event.target.value)} placeholder="tenantapple" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">X-Tenant-Signature</label>
              <Input value={tenantSignature} onChange={(event) => setTenantSignature(event.target.value)} placeholder="Signed tenant context" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={applySessionDefaults} className="rounded-full">
                <RefreshCcw className="h-4 w-4" /> Use Saved Session
              </Button>
              <Button type="button" onClick={clearAuthorization} variant="outline" className="rounded-full">
                Clear
              </Button>
            </div>

            <div className="rounded-2xl border border-sky-400/10 bg-sky-400/5 p-4 text-sm leading-6 text-muted-foreground">
              {status}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <QuickLink href={backendDocsUrl} label="Open Backend Docs" helper="Direct backend UI at /api/docs" />
              <QuickLink href={rawSpecUrl} label="Open Raw Spec" helper="Machine-readable OpenAPI JSON" />
            </div>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-xl shadow-slate-950/10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <div>
              <span className="font-semibold">Live Base:</span>{" "}
              <code className="rounded bg-slate-200 px-2 py-1 font-mono text-xs">{backendOrigin}/api</code>
            </div>
            <div className="text-xs text-slate-500">Swagger requests inherit the mode, token, and tenant values from the controls.</div>
          </div>
          <div className="swagger-surface min-h-[900px] p-3 md:p-4">
            <div ref={swaggerRef} />
          </div>
        </div>
      </div>

      <style jsx global>{`
        .swagger-surface .swagger-ui .topbar { display: none; }
        .swagger-surface .swagger-ui { font-family: "Space Grotesk", sans-serif; }
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
          background: linear-gradient(135deg, #0284c7, #16a34a);
          border-color: transparent;
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
        {icon}
      </div>
      <h3 className="mb-1 text-sm font-bold uppercase tracking-[0.18em] text-slate-100">{title}</h3>
      <p className="text-sm leading-6 text-slate-300">{body}</p>
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
