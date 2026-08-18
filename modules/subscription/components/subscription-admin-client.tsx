"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, Check, ChevronDown, ChevronRight, Loader2, RefreshCw, Route, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  assignTenantSubscription,
  fetchSubscriptionAdmin,
  updateSubscriptionAdminPlans,
  updateSubscriptionAdminPricing,
} from "@/modules/subscription/api";
import type {
  SubscriptionAdminFeature,
  SubscriptionAdminModule,
  SubscriptionAdminPlan,
  SubscriptionAdminTenant,
  TenantCatalogModule,
} from "@/modules/subscription/types";

const STATUSES = ["active", "trial", "inactive", "expired", "cancelled", "suspended", "pending_activation"];

type PlanDraft = {
  name: string;
  description: string;
  monthly_price_etb: number;
  mail_storage_quota_mb: number;
  trial_days: number;
  status: "active" | "inactive";
  enabled_modules: string[];
};

type PlanUpdatePayload = {
  plans: Record<string, PlanDraft>;
};

type TenantAssignmentPayload = {
  plan: string;
  status: string;
  reset_billing_window: boolean;
  module_subscriptions: {
    enabled_modules: string[];
    custom_modules: [];
  };
};

type PriceDraft = {
  monthly_price_etb: number;
};

type PricingUpdatePayload = {
  modules: Record<string, PriceDraft>;
  submodules: Record<string, PriceDraft>;
  features: Record<string, PriceDraft>;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || fallback;
  }

  return fallback;
};

const featureSummary = (module: SubscriptionAdminModule): string => {
  const submoduleCount = module.submodules?.length ?? 0;
  const featureCount = module.features?.length ?? 0;

  return `${submoduleCount} submodules / ${featureCount} features`;
};

export function SubscriptionAdminClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [selectedTenantId, setSelectedTenantId] = React.useState<string | null>(null);

  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ["subscription-admin", search],
    queryFn: () => fetchSubscriptionAdmin({ search }),
  });

  const plans: SubscriptionAdminPlan[] = React.useMemo(() => data?.data?.plans ?? [], [data]);
  const tenants: SubscriptionAdminTenant[] = React.useMemo(() => data?.data?.tenants ?? [], [data]);
  const catalog: TenantCatalogModule[] = React.useMemo(() => data?.data?.catalog ?? [], [data]);
  const registryModules: SubscriptionAdminModule[] = React.useMemo(() => data?.data?.modules ?? [], [data]);
  const matrixModules: SubscriptionAdminModule[] = React.useMemo(() => {
    if (registryModules.length > 0) {
      return registryModules;
    }

    return catalog.map((module, index) => ({
      ...module,
      id: index + 1,
      submodules: [],
      features: [],
    }));
  }, [catalog, registryModules]);
  const planDefaults: Record<string, string[]> = React.useMemo(() => data?.data?.plan_defaults ?? {}, [data]);
  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) ?? tenants[0];

  React.useEffect(() => {
    if (!selectedTenantId && tenants[0]) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [selectedTenantId, tenants]);

  const planMutation = useMutation({
    mutationFn: (payload: PlanUpdatePayload) => updateSubscriptionAdminPlans(payload),
    onSuccess: async () => {
      toast.success("Subscription plans saved.");
      await queryClient.invalidateQueries({ queryKey: ["subscription-admin"] });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Could not save plans.")),
  });

  const tenantMutation = useMutation({
    mutationFn: ({ tenantId, payload }: { tenantId: string; payload: TenantAssignmentPayload }) => assignTenantSubscription(tenantId, payload),
    onSuccess: async () => {
      toast.success("Tenant subscription updated.");
      await queryClient.invalidateQueries({ queryKey: ["subscription-admin"] });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Could not update tenant subscription.")),
  });

  const pricingMutation = useMutation({
    mutationFn: (payload: PricingUpdatePayload) => updateSubscriptionAdminPricing(payload),
    onSuccess: async () => {
      toast.success("Module pricing saved.");
      await queryClient.invalidateQueries({ queryKey: ["subscription-admin"] });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Could not save module pricing.")),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-red-700 bg-red-50 p-6 text-red-950 shadow-sm dark:border-red-300 dark:bg-red-950 dark:text-red-100"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <h2 className="text-xl font-black">Subscription catalog unavailable</h2>
            <p className="mt-2 text-sm leading-6">
              {getErrorMessage(
                error,
                "The subscription registry could not be loaded. No plan or tenant data has been changed.",
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
              className="mt-4 min-h-11 border-red-700 bg-white text-red-950 hover:bg-red-100 dark:border-red-300 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900"
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black tracking-tight">
              <Bell className="h-5 w-5 text-primary" />
              Demo Requests
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review inbound demo requests from the public landing page and track follow-up status.
            </p>
          </div>
          <Link href="/dashboard/subscriptions/demo-requests">
            <Button variant="outline" className="rounded-full font-bold">
              Open Demo Inbox
            </Button>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black tracking-tight">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Subscription Control
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage plan defaults, the discovered feature matrix, and tenant assignments from one place.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tenants"
              className="pl-9"
            />
          </div>
        </div>
      </section>

      <PlanMatrix
        plans={plans}
        modules={matrixModules}
        planDefaults={planDefaults}
        saving={planMutation.isPending}
        onSave={(payload) => planMutation.mutate(payload)}
      />

      <PricingMatrix
        modules={matrixModules}
        saving={pricingMutation.isPending}
        onSave={(payload) => pricingMutation.mutate(payload)}
      />

      <TenantAssignment
        tenants={tenants}
        selectedTenant={selectedTenant}
        modules={matrixModules}
        plans={plans}
        onSelectTenant={setSelectedTenantId}
        saving={tenantMutation.isPending}
        onSave={(tenantId, payload) => tenantMutation.mutate({ tenantId, payload })}
      />
    </div>
  );
}

function PlanMatrix({
  plans,
  modules,
  planDefaults,
  saving,
  onSave,
}: {
  plans: SubscriptionAdminPlan[];
  modules: SubscriptionAdminModule[];
  planDefaults: Record<string, string[]>;
  saving: boolean;
  onSave: (payload: PlanUpdatePayload) => void;
}) {
  const [drafts, setDrafts] = React.useState<Record<string, PlanDraft>>({});
  const [expandedModules, setExpandedModules] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const next = Object.fromEntries(plans.map((plan) => [
      plan.slug,
      {
        name: plan.name,
        description: plan.description ?? "",
        monthly_price_etb: plan.monthly_price_etb,
        mail_storage_quota_mb: plan.mail_storage_quota_mb,
        trial_days: plan.trial_days ?? 0,
        status: plan.status,
        enabled_modules: planDefaults[plan.slug] ?? [],
      },
    ]));
    setDrafts(next);
  }, [planDefaults, plans]);

  const toggleModule = (plan: string, module: string) => {
    setDrafts((current) => {
      const enabled = new Set(current[plan]?.enabled_modules ?? []);
      if (enabled.has(module)) {
        enabled.delete(module);
      } else {
        enabled.add(module);
      }

      return {
        ...current,
        [plan]: {
          ...current[plan],
          enabled_modules: Array.from(enabled),
        },
      };
    });
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black tracking-tight">Plan Feature Matrix</h3>
          <p className="text-sm text-muted-foreground">Plan changes update the catalog defaults used for new tenants and future assignments.</p>
        </div>
        <Button onClick={() => onSave({ plans: drafts })} disabled={saving} className="rounded-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Save Plans
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Feature</th>
              {plans.map((plan) => (
                <th key={plan.slug} className="p-3">{plan.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((module) => {
              const expanded = Boolean(expandedModules[module.slug]);

              return (
                <React.Fragment key={module.slug}>
                  <tr className="border-t border-border/50">
                    <td className="p-3 align-top">
                      <button
                        type="button"
                        onClick={() => setExpandedModules((current) => ({ ...current, [module.slug]: !expanded }))}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        {expanded ? <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                        <span>
                          <span className="block font-semibold text-foreground">{module.name}</span>
                          <span className="block text-xs text-muted-foreground">{module.category} / {featureSummary(module)}</span>
                        </span>
                      </button>
                    </td>
                    {plans.map((plan) => {
                      const active = drafts[plan.slug]?.enabled_modules?.includes(module.slug);
                      return (
                        <td key={`${plan.slug}-${module.slug}`} className="p-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggleModule(plan.slug, module.slug)}
                            className={cn(
                              "h-8 w-8 rounded-lg border text-xs font-bold transition",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-muted-foreground hover:border-primary"
                            )}
                            aria-label={`${active ? "Remove" : "Add"} ${module.name} on ${plan.name}`}
                          >
                            {active ? "On" : "Off"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                  {expanded ? (
                    <tr className="border-t border-border/30 bg-muted/20">
                      <td colSpan={plans.length + 1} className="p-4">
                        <FeatureInventory module={module} />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const toPrice = (value: unknown): number => {
  const next = Number(value ?? 0);
  return Number.isFinite(next) && next >= 0 ? next : 0;
};

function PricingMatrix({
  modules,
  saving,
  onSave,
}: {
  modules: SubscriptionAdminModule[];
  saving: boolean;
  onSave: (payload: PricingUpdatePayload) => void;
}) {
  const [drafts, setDrafts] = React.useState<PricingUpdatePayload>({
    modules: {},
    submodules: {},
    features: {},
  });
  const [expandedModules, setExpandedModules] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const next: PricingUpdatePayload = {
      modules: {},
      submodules: {},
      features: {},
    };

    modules.forEach((module) => {
      next.modules[module.slug] = { monthly_price_etb: toPrice(module.monthly_price_etb) };

      (module.submodules ?? []).forEach((submodule) => {
        const submoduleKey = `${module.slug}:${submodule.slug}`;
        next.submodules[submoduleKey] = { monthly_price_etb: toPrice(submodule.monthly_price_etb) };

        (submodule.features ?? []).forEach((feature) => {
          next.features[feature.slug] = { monthly_price_etb: toPrice(feature.monthly_price_etb) };
        });
      });

      (module.features ?? []).forEach((feature) => {
        next.features[feature.slug] = { monthly_price_etb: toPrice(feature.monthly_price_etb) };
      });
    });

    setDrafts(next);
  }, [modules]);

  const updatePrice = (scope: keyof PricingUpdatePayload, key: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [scope]: {
        ...current[scope],
        [key]: { monthly_price_etb: toPrice(value) },
      },
    }));
  };

  const renderPriceInput = (scope: keyof PricingUpdatePayload, key: string, label: string) => (
    <label className="block min-w-[140px] space-y-1">
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
          ETB
        </span>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={drafts[scope][key]?.monthly_price_etb ?? 0}
          onChange={(event) => updatePrice(scope, key, event.target.value)}
          className="h-10 bg-background pl-11 text-sm font-semibold"
          aria-label={`${label} price for ${key}`}
        />
      </div>
    </label>
  );

  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-black tracking-tight">Module Pricing</h3>
          <p className="text-sm text-muted-foreground">
            Set monthly prices for modules, submodules, and individual functionality. Module prices are used by tenant unlock checkout.
          </p>
        </div>
        <Button onClick={() => onSave(drafts)} disabled={saving} className="w-fit rounded-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Save Prices
        </Button>
      </div>

      <div className="space-y-3">
        {modules.map((module) => {
          const expanded = Boolean(expandedModules[module.slug]);
          const submoduleCount = module.submodules?.length ?? 0;
          const featureCount = module.features?.length ?? 0;

          return (
            <div key={module.slug} className="rounded-xl border border-border/50 bg-background/60">
              <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <button
                  type="button"
                  onClick={() => setExpandedModules((current) => ({ ...current, [module.slug]: !expanded }))}
                  className="flex min-w-0 items-start gap-2 text-left"
                >
                  {expanded ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                      {module.name}
                      <Badge variant={module.is_addon ? "outline" : "secondary"} className="rounded-full px-2 py-0.5 text-[11px] uppercase tracking-widest">
                        {module.is_addon ? "Addon" : "Major Module"}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {module.category} / {submoduleCount} submodules / {featureCount} features
                    </span>
                  </span>
                </button>
                {renderPriceInput("modules", module.slug, "Module Total")}
              </div>

              {expanded ? (
                <div className="border-t border-border/50 p-4">
                  <div className="grid gap-3 xl:grid-cols-2">
                    {(module.submodules ?? []).map((submodule) => {
                      const submoduleKey = `${module.slug}:${submodule.slug}`;

                      return (
                        <div key={submodule.id} className="rounded-xl border border-border/50 bg-card/60 p-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground">{submodule.name}</div>
                              <div className="mt-1 truncate text-[11px] text-muted-foreground">{submodule.slug}</div>
                            </div>
                            {renderPriceInput("submodules", submoduleKey, "Submodule")}
                          </div>
                          <div className="mt-3 space-y-2">
                            {(submodule.features ?? []).map((feature) => (
                              <div
                                key={feature.id}
                                className="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/70 p-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <FeaturePill feature={feature} />
                                {renderPriceInput("features", feature.slug, "Feature")}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {(module.features ?? []).filter((feature) => !feature.subscription_submodule_id).length > 0 ? (
                      <div className="rounded-xl border border-border/50 bg-card/60 p-3">
                        <div className="font-semibold text-foreground">General Features</div>
                        <div className="mt-3 space-y-2">
                          {(module.features ?? [])
                            .filter((feature) => !feature.subscription_submodule_id)
                            .map((feature) => (
                              <div
                                key={feature.id}
                                className="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/70 p-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <FeaturePill feature={feature} />
                                {renderPriceInput("features", feature.slug, "Feature")}
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TenantAssignment({
  tenants,
  selectedTenant,
  modules,
  plans,
  saving,
  onSelectTenant,
  onSave,
}: {
  tenants: SubscriptionAdminTenant[];
  selectedTenant?: SubscriptionAdminTenant;
  modules: SubscriptionAdminModule[];
  plans: SubscriptionAdminPlan[];
  saving: boolean;
  onSelectTenant: (tenantId: string) => void;
  onSave: (tenantId: string, payload: TenantAssignmentPayload) => void;
}) {
  const [plan, setPlan] = React.useState("business");
  const [status, setStatus] = React.useState("active");
  const [enabledModules, setEnabledModules] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!selectedTenant) return;
    setPlan(selectedTenant.subscription?.plan ?? selectedTenant.plan ?? "business");
    setStatus(selectedTenant.subscription?.status ?? "active");
    setEnabledModules(selectedTenant.subscription?.module_subscriptions?.enabled_modules ?? []);
  }, [selectedTenant]);

  if (!selectedTenant) {
    return null;
  }

  const toggleModule = (slug: string) => {
    setEnabledModules((current) => current.includes(slug)
      ? current.filter((item) => item !== slug)
      : [...current, slug]);
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-muted-foreground">Tenants</h3>
        <div className="space-y-2">
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => onSelectTenant(tenant.id)}
              className={cn(
                "w-full rounded-xl border p-3 text-left text-sm transition",
                selectedTenant.id === tenant.id ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/50"
              )}
            >
              <div className="font-semibold text-foreground">{tenant.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{tenant.id} / {tenant.subscription?.status}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight">{selectedTenant.name}</h3>
            <p className="text-sm text-muted-foreground">{selectedTenant.admin_email || "No admin email"} / {selectedTenant.business_type || "general"}</p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">{selectedTenant.id}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            Plan
            <select value={plan} onChange={(event) => setPlan(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3">
              {plans.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3">
              {STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => {
            const active = enabledModules.includes(module.slug);
            return (
              <button
                key={module.slug}
                type="button"
                onClick={() => toggleModule(module.slug)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  active ? "border-primary bg-primary/10" : "border-border/60 bg-background hover:border-primary/50"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-foreground">{module.name}</span>
                  <Badge variant={active ? "default" : "outline"} className="rounded-full">{active ? "On" : "Off"}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{module.description}</p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Route className="h-3 w-3" />
                  {featureSummary(module)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => onSave(selectedTenant.id, {
              plan,
              status,
              reset_billing_window: false,
              module_subscriptions: { enabled_modules: enabledModules, custom_modules: [] },
            })}
            disabled={saving}
            className="rounded-full"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Update Tenant Subscription
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeatureInventory({ module }: { module: SubscriptionAdminModule }) {
  const submodules = module.submodules ?? [];
  const looseFeatures = (module.features ?? []).filter((feature) => !feature.subscription_submodule_id);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {submodules.map((submodule) => (
        <div key={submodule.id} className="rounded-xl border border-border/50 bg-background p-3">
          <div className="text-sm font-bold text-foreground">{submodule.name}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{submodule.slug}</div>
          <div className="mt-2 space-y-1">
            {(submodule.features ?? []).slice(0, 5).map((feature) => (
              <FeaturePill key={feature.id} feature={feature} />
            ))}
            {(submodule.features?.length ?? 0) > 5 ? (
              <div className="text-[11px] text-muted-foreground">+{(submodule.features?.length ?? 0) - 5} more features</div>
            ) : null}
          </div>
        </div>
      ))}

      {looseFeatures.length > 0 ? (
        <div className="rounded-xl border border-border/50 bg-background p-3">
          <div className="text-sm font-bold text-foreground">General</div>
          <div className="mt-2 space-y-1">
            {looseFeatures.slice(0, 8).map((feature) => (
              <FeaturePill key={feature.id} feature={feature} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeaturePill({ feature }: { feature: SubscriptionAdminFeature }) {
  const methods = Array.isArray(feature.http_methods) ? feature.http_methods.join(",") : feature.feature_type;
  const label = feature.route_uri || feature.permission || feature.name;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/30 px-2 py-1">
      <div className="truncate text-[11px] font-semibold text-foreground">{label}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{methods}</div>
    </div>
  );
}
