"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, CalendarClock, ExternalLink, Mail, Phone, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/use-permissions";
import { getErrorMessage } from "@/lib/errors";
import { isTenantSession } from "@/lib/runtime-context";
import {
  expireDemoRequest,
  fetchDemoRequests,
  provisionDemoRequest,
  updateDemoRequest,
} from "@/modules/subscription/api";
import { DemoScopeSelector } from "@/modules/subscription/components/demo-scope-selector";
import type { SignupCatalogModule } from "@/modules/subscription/components/signup-catalog-selector";

type DemoRequest = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string;
  company_size: string | null;
  business_type: string;
  requested_modules: string[] | null;
  requested_submodules: string[] | null;
  message: string | null;
  status: string;
  notes: string | null;
  demo_plan: string | null;
  demo_tenant_id: string | null;
  demo_domain: string | null;
  demo_expires_at: string | null;
  provisioned_at: string | null;
  access_updated_at: string | null;
  last_provisioning_error: string | null;
  created_at: string;
};

type DemoCatalog = {
  modules: SignupCatalogModule[];
  business_types: Array<{ key: string; label: string }>;
  plans: Array<{ key: string; name: string }>;
  default_expiration_days: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  contacted: "Contacted",
  scheduled: "Scheduled",
  completed: "Completed",
  declined: "Declined",
  provisioning: "Provisioning",
  provisioned: "Live demo",
  expired: "Expired",
};

const EDITABLE_STATUSES = ["pending", "contacted", "scheduled", "completed", "declined", "provisioned"];

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "expired" || status === "declined") return "destructive";
  if (status === "provisioned") return "default";
  if (status === "pending") return "secondary";
  return "outline";
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "demo";
}

function localDateTime(value: string | null, days = 14) {
  const date = value ? new Date(value) : new Date(Date.now() + days * 86_400_000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not set";
}

export default function DemoRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasAnyPermission, isLoaded } = usePermissions();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search.trim());
  const canView = hasAnyPermission(["view_demo_requests", "manage_demo_requests", "process_demo_requests", "manage_tenants"]);

  React.useEffect(() => {
    if (isLoaded && (isTenantSession() || !canView)) router.replace("/dashboard/subscriptions");
  }, [canView, isLoaded, router]);

  const query = useQuery({
    queryKey: ["demo-requests", statusFilter, deferredSearch],
    queryFn: () => fetchDemoRequests({
      status: statusFilter === "all" ? undefined : statusFilter,
      search: deferredSearch || undefined,
      per_page: 50,
    }),
    enabled: isLoaded && canView && !isTenantSession(),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["demo-requests"] });
  const updateMutation = useMutation({ mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateDemoRequest>[1] }) => updateDemoRequest(id, payload), onSuccess: refresh });
  const provisionMutation = useMutation({ mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof provisionDemoRequest>[1] }) => provisionDemoRequest(id, payload), onSuccess: refresh });
  const expireMutation = useMutation({ mutationFn: expireDemoRequest, onSuccess: refresh });
  const requests = (query.data?.data ?? []) as DemoRequest[];
  const catalog = (query.data?.catalog ?? { modules: [], business_types: [], plans: [], default_expiration_days: 14 }) as DemoCatalog;

  if (!isLoaded || !canView || isTenantSession()) {
    return <div className="flex min-h-[420px] items-center justify-center"><Spinner className="size-8" /></div>;
  }

  return (
    <main className="demo-lease min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" asChild><Link href="/dashboard/subscriptions"><ArrowLeft data-icon="inline-start" />Subscriptions</Link></Button>
            <div><h1 className="text-2xl font-bold">Demo access leases</h1><p className="text-sm text-muted-foreground">Provision time-limited tenants with exact module access.</p></div>
          </div>
          <Badge variant="outline">{query.data?.meta?.total ?? requests.length} requests</Badge>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
        <section aria-labelledby="demo-filters-heading" className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_15rem]">
          <h2 id="demo-filters-heading" className="sr-only">Filter demo requests</h2>
          <Field><FieldLabel htmlFor="demo-search">Search</FieldLabel><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="demo-search" className="h-11 pl-10" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Company, email, tenant, or domain" /></div></Field>
          <Field><FieldLabel htmlFor="demo-status-filter">Status</FieldLabel><NativeSelect id="demo-status-filter" className="h-11 w-full" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><NativeSelectOption value="all">All statuses</NativeSelectOption>{Object.entries(STATUS_LABELS).map(([key, label]) => <NativeSelectOption key={key} value={key}>{label}</NativeSelectOption>)}</NativeSelect></Field>
        </section>

        {query.isLoading ? (
          <div className="flex flex-col gap-4" aria-label="Loading demo requests"><Skeleton className="h-44 w-full" /><Skeleton className="h-44 w-full" /></div>
        ) : query.isError ? (
          <Alert variant="destructive"><AlertTitle>Demo requests could not be loaded</AlertTitle><AlertDescription>{getErrorMessage(query.error, "Try refreshing the page.")}</AlertDescription></Alert>
        ) : requests.length === 0 ? (
          <Empty><EmptyHeader><EmptyMedia variant="icon"><ShieldCheck aria-hidden="true" /></EmptyMedia><EmptyTitle>No demo requests found</EmptyTitle><EmptyDescription>New public demo requests will appear here with their requested scope.</EmptyDescription></EmptyHeader></Empty>
        ) : (
          <section aria-label="Demo request list" className="flex flex-col gap-5">
            {requests.map((request) => (
              <DemoLeaseCard
                key={request.id}
                request={request}
                catalog={catalog}
                onSave={async (payload) => { try { await updateMutation.mutateAsync({ id: request.id, payload }); toast.success("Demo lease saved"); } catch (error) { toast.error(getErrorMessage(error, "Could not save demo lease.")); throw error; } }}
                onProvision={async (payload) => { try { await provisionMutation.mutateAsync({ id: request.id, payload }); toast.success("Demo tenant is ready"); } catch (error) { toast.error(getErrorMessage(error, "Could not provision demo tenant.")); throw error; } }}
                onExpire={async () => { try { await expireMutation.mutateAsync(request.id); toast.success("Demo access expired"); } catch (error) { toast.error(getErrorMessage(error, "Could not expire demo access.")); throw error; } }}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function DemoLeaseCard({ request, catalog, onSave, onProvision, onExpire }: {
  request: DemoRequest;
  catalog: DemoCatalog;
  onSave: (payload: Parameters<typeof updateDemoRequest>[1]) => Promise<unknown>;
  onProvision: (payload: Parameters<typeof provisionDemoRequest>[1]) => Promise<unknown>;
  onExpire: () => Promise<unknown>;
}) {
  const initialTenantId = request.demo_tenant_id ?? `${slugify(request.company)}-${request.id}`.slice(0, 20);
  const [status, setStatus] = React.useState(request.status === "provisioning" || request.status === "expired" ? "provisioned" : request.status);
  const [notes, setNotes] = React.useState(request.notes ?? "");
  const [businessType, setBusinessType] = React.useState(request.business_type || catalog.business_types[0]?.key || "general");
  const [plan, setPlan] = React.useState(request.demo_plan || catalog.plans[0]?.key || "business");
  const [expiresAt, setExpiresAt] = React.useState(localDateTime(request.demo_expires_at, catalog.default_expiration_days));
  const [tenantId, setTenantId] = React.useState(initialTenantId);
  const [domain, setDomain] = React.useState(request.demo_domain ?? `${initialTenantId}.localhost`);
  const [modules, setModules] = React.useState(request.requested_modules ?? []);
  const [submodules, setSubmodules] = React.useState(request.requested_submodules ?? []);
  const [busy, setBusy] = React.useState(false);
  const [confirmExpire, setConfirmExpire] = React.useState(false);
  const [error, setError] = React.useState("");
  const errorRef = React.useRef<HTMLDivElement>(null);
  const provisioned = Boolean(request.demo_tenant_id);
  const expired = request.status === "expired" || (request.demo_expires_at ? new Date(request.demo_expires_at) <= new Date() : false);
  const effectiveStatus = expired ? "expired" : request.status;

  const configuration = () => ({
    status,
    notes: notes.trim() || null,
    business_type: businessType,
    requested_modules: modules,
    requested_submodules: submodules,
    demo_plan: plan,
    demo_expires_at: new Date(expiresAt).toISOString(),
  });

  const changeBusinessType = (nextBusinessType: string) => {
    const compatibleSlugs = new Set(catalog.modules
      .filter((module) => !module.business_types?.length || module.business_types.includes(nextBusinessType))
      .map((module) => module.slug));

    setBusinessType(nextBusinessType);
    setModules((current) => current.filter((slug) => compatibleSlugs.has(slug)));
    setSubmodules((current) => current.filter((key) => compatibleSlugs.has(key.split(":")[0])));
  };

  const run = async (action: () => Promise<unknown>) => {
    setError("");
    if (!modules.length) {
      setError("Select at least one module before saving or provisioning.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt) <= new Date()) {
      setError("Choose an expiration date and time in the future.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, "The demo lease could not be updated."));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>{request.company}</h2></CardTitle>
        <CardDescription>{request.first_name} {request.last_name} · requested {formatDate(request.created_at)}</CardDescription>
        <CardAction><Badge variant={statusVariant(effectiveStatus)}>{STATUS_LABELS[effectiveStatus] ?? effectiveStatus}</Badge></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-muted-foreground">Contact</dt><dd><a className="font-medium underline-offset-4 hover:underline" href={`mailto:${request.email}`}><Mail className="mr-1 inline size-4" aria-hidden="true" />{request.email}</a></dd></div>
          <div><dt className="text-muted-foreground">Phone</dt><dd>{request.phone ? <a href={`tel:${request.phone}`}><Phone className="mr-1 inline size-4" aria-hidden="true" />{request.phone}</a> : "Not provided"}</dd></div>
          <div><dt className="text-muted-foreground">Tenant</dt><dd className="font-medium"><Building2 className="mr-1 inline size-4" aria-hidden="true" />{request.demo_tenant_id ?? "Not provisioned"}</dd></div>
          <div><dt className="text-muted-foreground">Expiration</dt><dd className="font-medium"><CalendarClock className="mr-1 inline size-4" aria-hidden="true" />{formatDate(request.demo_expires_at)}</dd></div>
        </dl>

        {request.message ? <Alert><AlertTitle>Prospect requirements</AlertTitle><AlertDescription>{request.message}</AlertDescription></Alert> : null}
        {request.last_provisioning_error ? <Alert variant="destructive"><AlertTitle>Last provisioning attempt failed</AlertTitle><AlertDescription>{request.last_provisioning_error}</AlertDescription></Alert> : null}

        <details className="rounded-xl border bg-muted/20">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>{provisioned ? "Edit demo lease" : "Configure and provision demo"}</span>
            <span className="text-sm font-normal text-muted-foreground">{modules.length} modules · {submodules.length} sub-modules</span>
          </summary>
          <div className="flex flex-col gap-7 border-t p-4">
            <FieldGroup>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <Field><FieldLabel htmlFor={`demo-status-${request.id}`}>Workflow status</FieldLabel><NativeSelect id={`demo-status-${request.id}`} className="h-11 w-full" value={status} onChange={(event) => setStatus(event.target.value)} disabled={busy}>{EDITABLE_STATUSES.map((key) => <NativeSelectOption key={key} value={key}>{STATUS_LABELS[key]}</NativeSelectOption>)}</NativeSelect></Field>
                <Field><FieldLabel htmlFor={`demo-business-${request.id}`}>Business type</FieldLabel><NativeSelect id={`demo-business-${request.id}`} className="h-11 w-full" value={businessType} onChange={(event) => changeBusinessType(event.target.value)} disabled={busy}>{catalog.business_types.map((option) => <NativeSelectOption key={option.key} value={option.key}>{option.label}</NativeSelectOption>)}</NativeSelect></Field>
                <Field><FieldLabel htmlFor={`demo-plan-${request.id}`}>Demo plan</FieldLabel><NativeSelect id={`demo-plan-${request.id}`} className="h-11 w-full" value={plan} onChange={(event) => setPlan(event.target.value)} disabled={busy}>{catalog.plans.map((option) => <NativeSelectOption key={option.key} value={option.key}>{option.name}</NativeSelectOption>)}</NativeSelect></Field>
                <Field><FieldLabel htmlFor={`demo-expiry-${request.id}`}>Expires at</FieldLabel><Input id={`demo-expiry-${request.id}`} className="h-11" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} disabled={busy} /><FieldDescription>Uses your current browser time zone.</FieldDescription></Field>
                <Field><FieldLabel htmlFor={`demo-tenant-${request.id}`}>Tenant ID</FieldLabel><Input id={`demo-tenant-${request.id}`} className="h-11" value={tenantId} onChange={(event) => { const next = slugify(event.target.value); setTenantId(next); if (!provisioned) setDomain(`${next}.localhost`); }} disabled={busy || provisioned} maxLength={20} /></Field>
                <Field><FieldLabel htmlFor={`demo-domain-${request.id}`}>Domain</FieldLabel><Input id={`demo-domain-${request.id}`} className="h-11" value={domain} onChange={(event) => setDomain(event.target.value.toLowerCase().trim())} disabled={busy || provisioned} /></Field>
              </div>
              <Field><FieldLabel htmlFor={`demo-notes-${request.id}`}>Internal notes</FieldLabel><Textarea id={`demo-notes-${request.id}`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} /></Field>
            </FieldGroup>

            <DemoScopeSelector modules={catalog.modules} businessType={businessType} selectedModules={modules} selectedSubmodules={submodules} onChange={(nextModules, nextSubmodules) => { setModules(nextModules); setSubmodules(nextSubmodules); }} disabled={busy} idPrefix={`admin-demo-${request.id}`} />

            {error ? <Alert ref={errorRef} tabIndex={-1} variant="destructive"><AlertTitle>Check the lease configuration</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" disabled={busy} onClick={() => run(() => onSave(configuration()))}>{busy ? <Spinner data-icon="inline-start" /> : null}Save changes</Button>
              <Button disabled={busy} onClick={() => run(() => onProvision({ ...configuration(), tenant_id: tenantId, tenant_name: request.company, domain }))}>{busy ? <Spinner data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" aria-hidden="true" />}{expired ? "Reactivate demo access" : (provisioned ? "Apply access and expiry" : "Provision demo tenant")}</Button>
              {request.demo_domain ? <Button variant="outline" asChild><a href={`//${request.demo_domain}`} target="_blank" rel="noreferrer">Open demo<ExternalLink data-icon="inline-end" aria-hidden="true" /></a></Button> : null}
            </div>
          </div>
        </details>
      </CardContent>

      {provisioned && !expired ? (
        <CardFooter className="flex flex-wrap justify-between gap-3 border-t">
          <p className="text-sm text-muted-foreground">Immediate expiration blocks protected tenant functionality on the next request.</p>
          {confirmExpire ? (
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setConfirmExpire(false)} disabled={busy}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await onExpire(); } catch (caught: unknown) { setError(getErrorMessage(caught, "Demo access could not be expired.")); requestAnimationFrame(() => errorRef.current?.focus()); } finally { setBusy(false); setConfirmExpire(false); } }}>{busy ? <Spinner data-icon="inline-start" /> : null}Confirm expiration</Button></div>
          ) : <Button variant="destructive" onClick={() => setConfirmExpire(true)}>Expire now</Button>}
        </CardFooter>
      ) : null}
    </Card>
  );
}
