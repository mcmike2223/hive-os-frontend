"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck, Check, Clock3, CreditCard, ExternalLink,
  HardDrive, Layers, Loader2, Mail, Rocket, ShieldCheck,
  Sparkles, Star, WandSparkles, Zap, ArrowRight, Crown,
  Lock, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ModulePageSkeleton } from "@/components/ui/loading-states";
import { usePermissions } from "@/hooks/use-permissions";
import { syncUserSession } from "@/lib/auth-sync";
import { logFrontendAction } from "@/modules/core/api";
import {
  fetchCurrentTenantSubscriptions,
  fetchPublicSubscriptionCatalog,
  syncCurrentTenantSubscriptionCheckout,
  updateCurrentTenantSubscriptions,
} from "@/modules/subscription/api";
import { ModuleSubscriptionCheckoutDialog } from "@/modules/subscription/components/module-subscription-checkout-dialog";
import { ModuleSubscriptionSelector } from "@/modules/subscription/components/module-subscription-selector";
import { ModuleSubscriptionSummary } from "@/modules/subscription/components/module-subscription-summary";
import type {
  TenantCatalogModule,
  TenantCustomModuleInput,
  TenantDirectTransferSettings,
  TenantModuleSubscriptionPayload,
  TenantPaymentProvider,
  TenantPlanPricing,
  TenantResolvedModuleSubscriptions,
  TenantSubscriptionFeatureMatrix,
  TenantSubscriptionFeatureMatrixModule,
  TenantSubscriptionOrder,
  TenantWorkspaceSubscription,
} from "@/modules/subscription/types";
import { useTenantModuleAccess } from "@/hooks/use-tenant-module-access";
import { useTranslation } from "@/store/use-translation";

// ─── Constants ──────────────────────────────────────────────────────────────
const EMPTY_STRING_LIST: string[] = [];
const EMPTY_CUSTOM_MODULES: TenantCustomModuleInput[] = [];
const EMPTY_CATALOG: TenantCatalogModule[] = [];
const EMPTY_ORDERS: TenantSubscriptionOrder[] = [];

// Plan metadata — storage quota mirrors TenantModuleCatalog.php
const PLAN_META: Record<string, {
  label: string; tagline: string; color: string; ring: string; bg: string;
  icon: React.ElementType; storageMb: number; storageLabel: string;
  highlight?: string;
}> = {
  larva:      { label: "Larva",      tagline: "Free trial workspace",          color: "text-slate-500",  ring: "ring-slate-500/30",  bg: "from-slate-500/10 to-slate-400/5",   icon: Zap,    storageMb: 512,    storageLabel: "512 MB" },
  startup:    { label: "Startup",    tagline: "Launch with core tools",        color: "text-sky-500",    ring: "ring-sky-500/30",    bg: "from-sky-500/10 to-cyan-400/5",      icon: Rocket, storageMb: 2048,   storageLabel: "2 GB" },
  business:   { label: "Business",   tagline: "For growing teams",             color: "text-indigo-500", ring: "ring-indigo-500/30", bg: "from-indigo-500/10 to-violet-400/5", icon: Layers, storageMb: 10240,  storageLabel: "10 GB",  highlight: "Most Popular" },
  enterprise: { label: "Enterprise", tagline: "Large-scale operations",        color: "text-violet-500", ring: "ring-violet-500/30", bg: "from-violet-500/10 to-purple-400/5", icon: Star,   storageMb: 51200,  storageLabel: "50 GB" },
  overlord:   { label: "Overlord",   tagline: "Full stack, unlimited power",   color: "text-amber-500",  ring: "ring-amber-500/30",  bg: "from-amber-500/10 to-orange-400/5",  icon: Crown,  storageMb: 204800, storageLabel: "200 GB", highlight: "All-Inclusive" },
};

const PLAN_ORDER = ["larva", "startup", "business", "enterprise", "overlord"];

const PLAN_MODULES_COUNT: Record<string, number> = {
  larva: 1,      // mailbox only
  startup: 4,    // mailbox + file_manager + image_editor + document_converter
  business: 14,  // business defaults + hospitality + B2B marketplace
  enterprise: 18, // enterprise defaults + hospitality + B2B marketplace
  overlord: 19,  // all catalog modules except lightweight media utilities
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const sanitizeCustomModules = (modules: TenantCustomModuleInput[]): TenantCustomModuleInput[] =>
  modules.map(m => ({ slug: m.slug?.trim() || undefined, name: m.name.trim(), category: m.category?.trim() || "Custom", description: m.description?.trim() || "" }))
         .filter(m => m.name.length > 0);

const cloneCustomModules = (modules: TenantCustomModuleInput[]): TenantCustomModuleInput[] =>
  modules.map(m => ({ slug: m.slug, name: m.name, category: m.category, description: m.description }));

const areStringListsEqual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const areCustomModulesEqual = (a: TenantCustomModuleInput[], b: TenantCustomModuleInput[]) =>
  a.length === b.length && a.every((m, i) => m.slug === b[i]?.slug && m.name === b[i]?.name && m.category === b[i]?.category && m.description === b[i]?.description);

const buildSnapshot = (enabledModules: string[], customModules: TenantCustomModuleInput[]) =>
  JSON.stringify({ enabled_modules: [...enabledModules].sort(), custom_modules: sanitizeCustomModules(customModules) });

const findCatalogModules = (catalog: TenantCatalogModule[], slugs: string[]): TenantCatalogModule[] => {
  const lookup = new Map(catalog.map(m => [m.slug, m]));
  return slugs.map(s => lookup.get(s)).filter((m): m is TenantCatalogModule => Boolean(m));
};

const formatMoney = (value: number) => `ETB ${Number(value || 0).toFixed(0)}`;
const formatBytes = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`;
const isOrderActive = (status: string | undefined) =>
  ["pending_payment", "payment_processing", "paid", "pending_manual_review"].includes(String(status || "").toLowerCase());
const formatSubscriptionStatus = (status: string | undefined) =>
  String(status || "active").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

type SubscriptionApiError = {
  response?: {
    data?: {
      code?: string;
      message?: string;
      modules?: string[];
    };
  };
};

// ─── Plan Card ───────────────────────────────────────────────────────────────
function PlanCard({
  planKey,
  currentPlan,
  pricing,
  includedModules,
  addonModules,
}: {
  planKey: string;
  currentPlan: string;
  pricing?: TenantPlanPricing;
  includedModules: TenantCatalogModule[];
  addonModules: TenantCatalogModule[];
}) {
  const meta = PLAN_META[planKey];
  if (!meta) return null;
  const PlanIcon = meta.icon;
  const isCurrent = planKey === currentPlan;
  const planIndex = PLAN_ORDER.indexOf(planKey);
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const isUpgrade = planIndex > currentIndex;
  const storageLabel = pricing?.mail_storage_quota_mb ? formatBytes(pricing.mail_storage_quota_mb) : meta.storageLabel;
  const planPrice = Number(pricing?.monthly_price_etb ?? 0);
  const previewModules = includedModules.slice(0, 3);
  const previewAddons = addonModules.slice(0, 2);

  return (
    <div className={cn(
      "relative flex flex-col rounded-[2rem] border p-5 transition-all duration-300 hover:shadow-lg overflow-hidden",
      isCurrent
        ? `ring-2 ${meta.ring} border-transparent bg-gradient-to-br ${meta.bg} shadow-md`
        : "border-border/50 bg-card/40 backdrop-blur-md hover:bg-card/60"
    )}>
      {/* Popular / Highlight badge */}
      {meta.highlight && (
        <div className={cn("absolute top-4 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider", meta.color, `bg-gradient-to-br ${meta.bg} border border-current/20`)}>
          {meta.highlight}
        </div>
      )}

      {isCurrent && (
        <div className="absolute top-4 left-4 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-green-600 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Current Plan
        </div>
      )}

      <div className={cn("mt-7 h-10 w-10 rounded-2xl flex items-center justify-center bg-gradient-to-br", meta.bg)}>
        <PlanIcon className={cn("h-5 w-5", meta.color)} />
      </div>

      <h3 className={cn("mt-3 text-xl font-black uppercase tracking-tight", meta.color)}>{meta.label}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{meta.tagline}</p>
      <p className="mt-3 text-2xl font-black tracking-tight text-foreground">{formatMoney(planPrice)}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">per month from included modules</p>

      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-foreground/80">
          <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span><strong>{storageLabel}</strong> mailbox storage</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground/80">
          <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span><strong>{includedModules.length || PLAN_MODULES_COUNT[planKey]}</strong> major modules included</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground/80">
          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>Secure internal mailbox</span>
        </div>
      </div>

      {previewModules.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {previewModules.map((module) => (
            <Badge key={`${planKey}-${module.slug}`} variant="secondary" className="rounded-full text-[10px]">
              {module.name}
            </Badge>
          ))}
          {includedModules.length > previewModules.length ? (
            <Badge variant="outline" className="rounded-full text-[10px]">
              +{includedModules.length - previewModules.length} more
            </Badge>
          ) : null}
        </div>
      ) : null}

      {previewAddons.length > 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border/60 bg-background/40 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Available Add-ons</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previewAddons.map((module) => (
              <Badge key={`${planKey}-addon-${module.slug}`} variant="outline" className="rounded-full text-[10px]">
                {module.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {isUpgrade && (
        <Button size="sm" variant="outline" className={cn("mt-5 w-full rounded-xl text-xs font-bold gap-1.5 border-current/20 hover:bg-gradient-to-br hover:border-transparent transition-all", meta.color, `hover:${meta.bg}`)}>
          Upgrade to {meta.label} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Storage Quota Panel ───────────────────────────────────────────────────
function StorageQuotaPanel({ storageMb, usedBytes = 0 }: { storageMb: number; usedBytes?: number }) {
  const totalBytes = storageMb * 1024 * 1024;
  const pct = totalBytes > 0 ? Math.min(100, (usedBytes / totalBytes) * 100) : 0;
  const usedMb = usedBytes / (1024 * 1024);
  const isWarning = pct > 75;
  const isCritical = pct > 90;

  return (
    <div className="rounded-[1.75rem] border border-border/50 bg-card/40 backdrop-blur-md p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", isCritical ? "bg-rose-500/10" : isWarning ? "bg-amber-500/10" : "bg-primary/10")}>
          <HardDrive className={cn("h-[18px] w-[18px]", isCritical ? "text-rose-500" : isWarning ? "text-amber-500" : "text-primary")} />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mailbox Storage</p>
          <p className="text-lg font-black text-foreground">{formatBytes(storageMb)} <span className="text-muted-foreground font-medium text-sm">total</span></p>
        </div>
      </div>

      <Progress
        value={pct}
        className={cn("h-2.5 rounded-full", isCritical && "[&>div]:bg-rose-500", isWarning && !isCritical && "[&>div]:bg-amber-500")}
      />

      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{usedMb.toFixed(1)} MB used</span>
        <span className={cn("font-semibold", isCritical ? "text-rose-500" : isWarning ? "text-amber-500" : "")}>{pct.toFixed(1)}%</span>
      </div>

      {isCritical && (
        <p className="mt-2 text-[11px] text-rose-500 font-medium">⚠ Storage critical — consider upgrading your plan</p>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
function FeatureAccessMatrix({
  matrix,
  canManage,
  onModuleRequest,
}: {
  matrix?: TenantSubscriptionFeatureMatrix;
  canManage: boolean;
  onModuleRequest: (module: TenantSubscriptionFeatureMatrixModule) => void;
}) {
  const modules = React.useMemo(() => matrix?.modules ?? [], [matrix?.modules]);
  const groupedModules = React.useMemo(() => {
    return modules.reduce<Record<string, TenantSubscriptionFeatureMatrixModule[]>>((groups, module) => {
      const group = groups[module.category] ?? [];
      group.push(module);
      groups[module.category] = group;
      return groups;
    }, {});
  }, [modules]);

  if (modules.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-black tracking-tight text-foreground">
            <ListChecks className="h-5 w-5 text-primary" /> Feature Access Matrix
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Every central module, submodule, route, page, and action discovered for this tenant workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
            {matrix?.subscribed_module_count ?? 0} subscribed
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
            {matrix?.unsubscribed_module_count ?? 0} available
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
            {matrix?.feature_count ?? 0} features
          </Badge>
        </div>
      </div>

      <div className="space-y-5">
        {Object.entries(groupedModules).map(([category, categoryModules]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border/60" />
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">{category}</p>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {categoryModules.map((module) => {
                const isActive = module.status === "active";
                const isPending = module.status === "pending";
                const price = Number(module.monthly_price_etb ?? 0);

                return (
                  <article
                    key={module.slug}
                    className={cn(
                      "rounded-[1.5rem] border p-4 shadow-sm transition-colors",
                      isActive
                        ? "border-emerald-300/50 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/15"
                        : isPending
                          ? "border-indigo-300/50 bg-indigo-50/50 dark:border-indigo-800/40 dark:bg-indigo-950/15"
                          : "border-border/60 bg-card/45"
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-black text-foreground">{module.name}</h4>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-widest",
                              isActive
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : isPending
                                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                            )}
                          >
                            {isActive ? "Subscribed" : isPending ? "Payment Pending" : "Not Subscribed"}
                          </Badge>
                          {module.included_in_plan ? (
                            <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[9px] uppercase tracking-widest text-sky-700">
                              Plan Included
                            </Badge>
                          ) : null}
                          {module.is_addon ? (
                            <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[9px] uppercase tracking-widest text-amber-700">
                              Add-on
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{module.description}</p>
                      </div>
                      {!isActive && !isPending ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={canManage ? "default" : "outline"}
                          disabled={!canManage}
                          onClick={() => onModuleRequest(module)}
                          className="shrink-0 rounded-full gap-2"
                        >
                          <Lock className="h-4 w-4" />
                          {price > 0 ? `Unlock ETB ${price.toFixed(0)}` : "Enable"}
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-3">
                      {module.submodules.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                          No submodules were discovered for this module yet.
                        </p>
                      ) : (
                        module.submodules.map((submodule) => (
                          <div key={`${module.slug}-${submodule.slug}`} className="rounded-xl border border-border/60 bg-background/70 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-bold text-foreground">{submodule.name}</p>
                              <Badge variant="secondary" className="rounded-full text-[10px]">
                                {submodule.feature_count} feature{submodule.feature_count === 1 ? "" : "s"}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {submodule.features.slice(0, 8).map((feature) => (
                                <Badge key={feature.slug} variant="outline" className="max-w-full rounded-full px-2.5 py-1 text-[10px]">
                                  <span className="truncate">{feature.name}</span>
                                </Badge>
                              ))}
                              {submodule.features.length > 8 ? (
                                <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[10px]">
                                  +{submodule.features.length - 8} more
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TenantSubscriptionsClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasAnyPermission } = usePermissions();
  const { moduleAccess } = useTenantModuleAccess();
  const { t } = useTranslation();

  const canManage = hasAnyPermission(["manage_module_subscriptions"]);
  const [selectedModules, setSelectedModules] = React.useState<string[]>([]);
  const [customModules, setCustomModules] = React.useState<TenantCustomModuleInput[]>([]);
  const [checkoutModules, setCheckoutModules] = React.useState<TenantCatalogModule[]>([]);
  const [checkoutMode, setCheckoutMode] = React.useState<"upgrade" | "renewal">("upgrade");
  const handledCheckoutTokenRef = React.useRef<string | null>(null);
  const handledCancelRef = React.useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-current-subscriptions"],
    queryFn: fetchCurrentTenantSubscriptions,
  });

  const { data: publicCatalogData, isLoading: isPublicCatalogLoading } = useQuery({
    queryKey: ["tenant-public-subscription-catalog"],
    queryFn: fetchPublicSubscriptionCatalog,
  });

  const tenant = data?.data?.tenant;
  const subscription: TenantWorkspaceSubscription | undefined = data?.data?.subscription;
  const subscriptions: TenantResolvedModuleSubscriptions | undefined = data?.data?.module_subscriptions;
  const featureMatrix: TenantSubscriptionFeatureMatrix | undefined = data?.data?.feature_matrix;
  const currentPlan = (tenant?.plan ?? subscription?.plan ?? moduleAccess?.plan ?? "business").toLowerCase();
  const accessEnabledModules = React.useMemo(() => {
    const activeModules = moduleAccess?.active_modules ?? [];
    if (activeModules.length > 0) {
      return activeModules;
    }

    return Object.entries(moduleAccess?.statuses ?? {})
      .filter(([, status]) => status.active)
      .map(([slug]) => slug);
  }, [moduleAccess]);
  const serverEnabledModules = React.useMemo(() => {
    const enabled = subscriptions?.enabled_modules ?? [];
    return enabled.length > 0 ? enabled : accessEnabledModules;
  }, [accessEnabledModules, subscriptions?.enabled_modules]);
  const rawCatalog = React.useMemo<TenantCatalogModule[]>(() => {
    if ((subscriptions?.catalog_modules?.length ?? 0) > 0) {
      return subscriptions?.catalog_modules ?? EMPTY_CATALOG;
    }

    if ((data?.data?.catalog?.length ?? 0) > 0) {
      return data?.data?.catalog;
    }

    return publicCatalogData?.data?.catalog ?? EMPTY_CATALOG;
  }, [data?.data?.catalog, publicCatalogData?.data?.catalog, subscriptions?.catalog_modules]);
  const planDefaults = React.useMemo<Record<string, string[]>>(
    () => data?.data?.plan_defaults ?? publicCatalogData?.data?.plan_defaults ?? {},
    [data?.data?.plan_defaults, publicCatalogData?.data?.plan_defaults]
  );
  const catalog = React.useMemo(() => {
    const includedModules = planDefaults[currentPlan] ?? [];

    return rawCatalog.map((module) => {
      const accessStatus = moduleAccess?.statuses?.[module.slug];
      const isActive = serverEnabledModules.includes(module.slug) || accessStatus?.active === true || module.status === "active";
      const isPending = module.status === "pending";

      return {
        ...module,
        included_in_plan: module.included_in_plan ?? accessStatus?.included_in_plan ?? includedModules.includes(module.slug),
        status: isActive ? "active" : (isPending ? "pending" : "inactive"),
      } satisfies TenantCatalogModule;
    });
  }, [currentPlan, moduleAccess?.statuses, planDefaults, rawCatalog, serverEnabledModules]);
  const effectiveFeatureMatrix = React.useMemo<TenantSubscriptionFeatureMatrix | undefined>(() => {
    if ((featureMatrix?.modules?.length ?? 0) > 0) {
      return featureMatrix;
    }

    if (catalog.length === 0) {
      return undefined;
    }

    const modules = catalog.map((module) => ({
      ...module,
      subscribed: module.status === "active",
      submodules: [],
      submodule_count: 0,
      feature_count: 0,
    }));

    return {
      modules,
      module_count: modules.length,
      subscribed_module_count: modules.filter((module) => module.subscribed).length,
      unsubscribed_module_count: modules.filter((module) => !module.subscribed).length,
      submodule_count: 0,
      feature_count: 0,
    };
  }, [catalog, featureMatrix]);
  const planPricing = React.useMemo<Record<string, TenantPlanPricing>>(() => data?.data?.plan_pricing ?? publicCatalogData?.data?.plan_pricing ?? {}, [data?.data?.plan_pricing, publicCatalogData?.data?.plan_pricing]);
  const paymentProvider: TenantPaymentProvider | undefined = data?.data?.payment_provider ?? publicCatalogData?.data?.payment_provider;
  const directTransfer: TenantDirectTransferSettings | undefined = data?.data?.direct_transfer ?? publicCatalogData?.data?.direct_transfer;
  const paymentMethods = data?.data?.payment_methods ?? publicCatalogData?.data?.payment_methods ?? [];
  const pendingOrders: TenantSubscriptionOrder[] = data?.data?.pending_orders ?? EMPTY_ORDERS;
  const planMeta = PLAN_META[currentPlan] ?? PLAN_META.business;
  const PlanIcon = planMeta.icon;

  const serverCustomModules = subscriptions?.custom_modules ?? EMPTY_CUSTOM_MODULES;
  const selectedSummaryModules = React.useMemo(() => {
    if ((subscriptions?.selected_modules?.length ?? 0) > 0) {
      return subscriptions?.selected_modules;
    }

    const lookup = new Map(catalog.map((module) => [module.slug, module]));
    return serverEnabledModules
      .flatMap((slug) => {
        const catalogModule = lookup.get(slug);

        if (!catalogModule) {
          return [];
        }

        return [{
          slug: catalogModule.slug,
          name: catalogModule.name,
          description: catalogModule.description,
          category: catalogModule.category,
          tone: catalogModule.tone,
          source: "catalog" as const,
        }];
      });
  }, [catalog, serverEnabledModules, subscriptions?.selected_modules]);
  const activeModuleCount = selectedSummaryModules?.length ?? serverEnabledModules.length;
  const renewalEstimate = React.useMemo(() => {
    const basePlanPrice = Number(planPricing?.[currentPlan]?.monthly_price_etb ?? 0);
    const activePaidAddons = catalog
      .filter((module: TenantCatalogModule) => serverEnabledModules.includes(module.slug) && !module.included_in_plan)
      .reduce((sum: number, module: TenantCatalogModule) => sum + Number(module.monthly_price_etb ?? 0), 0);

    return basePlanPrice + activePaidAddons;
  }, [catalog, currentPlan, planPricing, serverEnabledModules]);

  React.useEffect(() => {
    setSelectedModules(prev => areStringListsEqual(prev, serverEnabledModules) ? prev : [...serverEnabledModules]);
    setCustomModules(prev => areCustomModulesEqual(prev, serverCustomModules) ? prev : cloneCustomModules(serverCustomModules));
  }, [serverCustomModules, serverEnabledModules]);

  const initialSnapshot = React.useMemo(() => buildSnapshot(serverEnabledModules, serverCustomModules), [serverCustomModules, serverEnabledModules]);
  const currentSnapshot = React.useMemo(() => buildSnapshot(selectedModules, customModules), [customModules, selectedModules]);
  const hasChanges = currentSnapshot !== initialSnapshot;

  const saveMutation = useMutation({
    mutationFn: (payload: { module_subscriptions: TenantModuleSubscriptionPayload }) =>
      updateCurrentTenantSubscriptions(payload),
    onSuccess: async (response) => {
      queryClient.setQueryData(["tenant-current-subscriptions"], response);
      await syncUserSession();
      toast.success(response?.message ?? "Module subscriptions updated.");
      await logFrontendAction({ module: "Module Subscriptions", action: "updated", description: "Tenant administrator updated workspace module subscriptions." }).catch(() => {});
    },
    onError: (error: SubscriptionApiError) => {
      const checkoutRequired = error?.response?.data?.code === "SUBSCRIPTION_CHECKOUT_REQUIRED";
      if (checkoutRequired) {
        const requiredModules = findCatalogModules(catalog, error?.response?.data?.modules ?? EMPTY_STRING_LIST);
        setCheckoutMode("upgrade");
        if (requiredModules.length > 0) setCheckoutModules(requiredModules);
        toast.info(error?.response?.data?.message || "Checkout is required before these paid modules can be activated.");
        return;
      }
      toast.error(error?.response?.data?.message || t("global.operation_failed", "Operation failed."));
    },
  });

  const checkoutSyncMutation = useMutation({
    mutationFn: (token: string) => syncCurrentTenantSubscriptionCheckout(token),
    onSuccess: async (response) => {
      const order = response?.data?.order as TenantSubscriptionOrder | undefined;
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["tenant-current-subscriptions"] }), syncUserSession()]);
      if (order?.status === "provisioned") toast.success(order?.scope === "tenant_renewal" ? "Your tenant subscription has been renewed." : "Your new module subscription is active now.");
      else if (order?.status === "pending_manual_review") toast.info(order?.scope === "tenant_renewal" ? "Your renewal transfer is waiting for admin verification." : "Your transfer was submitted and is waiting for admin verification.");
      else if (order?.status === "manual_payment_rejected") toast.error("The submitted transfer reference did not match. Please submit a new one.");
      else if (order?.status === "failed") toast.error("Payment was received as failed. Please try again.");
      else if (order?.status === "cancelled") toast.info("Checkout was cancelled before payment confirmation.");
      else toast.info(order?.scope === "tenant_renewal" ? "Your renewal payment is being verified." : "Your payment is being verified. The modules will unlock shortly.");
      router.replace("/dashboard/subscriptions");
    },
    onError: (error: SubscriptionApiError) => {
      toast.error(error?.response?.data?.message || "We could not verify the checkout result yet.");
      router.replace("/dashboard/subscriptions");
    },
  });

  const checkoutToken = searchParams.get("checkout");
  const checkoutCancelled = searchParams.get("cancelled");

  React.useEffect(() => {
    if (!checkoutToken || handledCheckoutTokenRef.current === checkoutToken) return;
    handledCheckoutTokenRef.current = checkoutToken;
    checkoutSyncMutation.mutate(checkoutToken);
  }, [checkoutSyncMutation, checkoutToken]);

  React.useEffect(() => {
    if (!checkoutCancelled || handledCancelRef.current === checkoutCancelled) return;
    handledCancelRef.current = checkoutCancelled;
    toast.info("Checkout was cancelled before payment confirmation.");
    router.replace("/dashboard/subscriptions");
  }, [checkoutCancelled, router]);

  const handleSave = React.useCallback(() => {
    saveMutation.mutate({ module_subscriptions: { enabled_modules: selectedModules, custom_modules: sanitizeCustomModules(customModules) } });
  }, [customModules, saveMutation, selectedModules]);

  const handleLockedModuleRequest = React.useCallback((module: TenantCatalogModule) => {
    setCheckoutMode("upgrade");
    setCheckoutModules([module]);
  }, []);

  const handleMatrixModuleRequest = React.useCallback((module: TenantSubscriptionFeatureMatrixModule) => {
    if (selectedModules.includes(module.slug)) return;

    if (module.included_in_plan || Number(module.monthly_price_etb ?? 0) <= 0) {
      setSelectedModules((previous) => previous.includes(module.slug) ? previous : [...previous, module.slug]);
      toast.info(`${module.name} is ready to enable. Save changes to apply it to this tenant.`);
      return;
    }

    setCheckoutMode("upgrade");
    setCheckoutModules([module]);
  }, [selectedModules]);

  const handleRenewalRequest = React.useCallback(() => {
    setCheckoutMode("renewal");
    setCheckoutModules(findCatalogModules(catalog, subscriptions?.enabled_modules ?? EMPTY_STRING_LIST));
  }, [catalog, subscriptions?.enabled_modules]);

  if (isLoading || (catalog.length === 0 && isPublicCatalogLoading)) {
    return <ModulePageSkeleton titleWidth="w-56" subtitleWidth="w-80" rows={5} cols={3} />;
  }

  return (
    <div className="space-y-8">

      {/* ─── 1. HERO PLAN BANNER ────────────────────────────────────────── */}
      <div className={cn(
        "relative overflow-hidden rounded-[2rem] border p-8 shadow-md bg-gradient-to-br",
        planMeta.bg,
        `ring-1 ${planMeta.ring}`
      )}>
        {/* Background texture */}
        <div className="pointer-events-none absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        </div>

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className={cn("h-16 w-16 rounded-[1.25rem] flex items-center justify-center bg-white/20 backdrop-blur-sm shadow-inner border border-white/20")}>
              <PlanIcon className={cn("h-8 w-8", planMeta.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border", planMeta.color, `bg-gradient-to-br ${planMeta.bg} border-current/20`)}>
                  Active Plan
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70 bg-background/50 border border-border/60 px-2 py-0.5 rounded-full">
                  {formatSubscriptionStatus(subscription?.status)}
                </span>
                {planMeta.highlight && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    ✦ {planMeta.highlight}
                  </span>
                )}
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">{planMeta.label}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{planMeta.tagline}</p>
            </div>
          </div>

          {/* Plan quick-stats */}
          <div className="flex flex-wrap gap-4">
            {[
              { icon: HardDrive, label: "Storage", value: planMeta.storageLabel },
              { icon: Layers, label: "Modules", value: `${activeModuleCount} active` },
              { icon: BadgeCheck, label: "Status", value: formatSubscriptionStatus(subscription?.status) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center min-w-[80px]">
                <div className="flex justify-center mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-sm font-black text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 2. KPI STRIP ───────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Layers, label: "Active Modules", value: activeModuleCount, sub: "Enabled in workspace", iconBg: "bg-primary/10", iconColor: "text-primary" },
          { icon: Sparkles, label: "Current Plan", value: planMeta.label, sub: planMeta.tagline, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500" },
          { icon: ShieldCheck, label: "Access Mode", value: canManage ? "Editable" : "Read-only", sub: canManage ? "You can manage modules" : "Another operator required", iconBg: "bg-sky-500/10", iconColor: "text-sky-500" },
          { icon: Clock3, label: "Renews", value: subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : "N/A", sub: subscription?.needs_renewal ? "Renewal recommended now" : "Next billing checkpoint", iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
        ].map(({ icon: Icon, label, value, sub, iconBg, iconColor }) => (
          <div key={label} className="rounded-[1.75rem] border border-border/50 bg-card/40 backdrop-blur-md p-5 shadow-sm hover:shadow-md hover:bg-card/60 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-foreground">{value}</h3>
              </div>
              <div className={cn("rounded-2xl p-3", iconBg)}>
                <Icon className={cn("h-6 w-6", iconColor)} />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
      <div className={cn(
        "rounded-[1.75rem] border p-5 shadow-sm",
        subscription?.status === "expired"
          ? "border-rose-300/50 bg-rose-50/70 dark:border-rose-800/40 dark:bg-rose-950/20"
          : subscription?.needs_renewal
            ? "border-amber-300/50 bg-amber-50/70 dark:border-amber-800/40 dark:bg-amber-950/20"
            : "border-emerald-300/40 bg-emerald-50/70 dark:border-emerald-800/30 dark:bg-emerald-950/20"
      )}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subscription Window</p>
            <p className="text-lg font-black text-foreground">
              {subscription?.expires_at ? `Expires ${new Date(subscription.expires_at).toLocaleDateString()}` : "Expiry pending"}
            </p>
            <p className="text-sm text-muted-foreground">
              {subscription?.status === "expired"
                ? `Grace period ended ${subscription.grace_ends_at ? new Date(subscription.grace_ends_at).toLocaleDateString() : "recently"}.`
                : subscription?.status === "grace_period"
                  ? `Grace period ends ${subscription.grace_ends_at ? new Date(subscription.grace_ends_at).toLocaleDateString() : "soon"}.`
                  : subscription?.needs_renewal
                    ? `${subscription?.days_until_expiration ?? 0} day(s) left before renewal is due.`
                    : "Your workspace subscription is in a healthy renewal window."}
            </p>
          </div>
          {canManage ? (
            <Button onClick={handleRenewalRequest} className="rounded-full px-6 font-semibold">
              Renew Subscription
            </Button>
          ) : null}
        </div>
      </div>

      {/* ─── 3. PLAN COMPARISON GRID ────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black tracking-tight text-foreground">Subscription Plans</h3>
            <p className="text-sm text-muted-foreground">Each plan includes a dedicated mailbox storage quota and a set of included modules.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PLAN_ORDER.map(planKey => {
            const moduleLookup = new Map(catalog.map(module => [module.slug, module]));
            const planModules = (planDefaults[planKey] ?? [])
              .flatMap(slug => {
                const catalogModule = moduleLookup.get(slug);
                return catalogModule ? [catalogModule] : [];
              });
            const majorModules = planModules.filter(module => !module.is_addon);
            const addonModules = catalog.filter(module => module.is_addon);

            return (
              <PlanCard
                key={planKey}
                planKey={planKey}
                currentPlan={currentPlan}
                pricing={planPricing[planKey]}
                includedModules={majorModules}
                addonModules={addonModules}
              />
            );
          })}
        </div>
      </div>

      {/* ─── 4. STORAGE QUOTA ───────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <StorageQuotaPanel storageMb={planMeta.storageMb} />
        <div className="md:col-span-2 rounded-[1.75rem] border border-border/50 bg-card/40 backdrop-blur-md p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Storage by Plan</p>
          <div className="space-y-3">
            {PLAN_ORDER.map(pk => {
              const pm = PLAN_META[pk];
              const pct = (pm.storageMb / (PLAN_META.overlord.storageMb)) * 100;
              const isCurrent = pk === currentPlan;
              return (
                <div key={pk} className="flex items-center gap-3">
                  <span className={cn("text-[11px] font-bold w-20 shrink-0", pm.color)}>{pm.label}</span>
                  <div className="flex-1">
                    <Progress value={pct} className={cn("h-2 rounded-full", isCurrent && "[&>div]:bg-current opacity-100")} />
                  </div>
                  <span className={cn("text-[11px] font-mono w-14 text-right shrink-0", isCurrent ? "font-black text-foreground" : "text-muted-foreground")}>{pm.storageLabel}</span>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 5. PENDING ORDERS ──────────────────────────────────────────── */}
      {pendingOrders.length > 0 && (
        <div className="rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-black tracking-tight text-foreground">
                <CreditCard className="h-5 w-5 text-primary" /> Recent Checkout Activity
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">Resume gateway links or monitor manual transfer submissions that are still awaiting confirmation.</p>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
              {paymentProvider?.label ?? "Payment"}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pendingOrders.map(order => (
              <div key={order.id} className="rounded-[1.5rem] border border-border/60 bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {order.scope === "tenant_upgrade"
                        ? "Tenant Module Upgrade"
                        : order.scope === "tenant_renewal"
                          ? "Tenant Renewal"
                          : "Tenant Signup"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{order.created_at ? `Created ${new Date(order.created_at).toLocaleString()}` : "Created recently"}</p>
                  </div>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest shrink-0">
                    {String(order.status).replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(order.module_request?.enabled_modules ?? EMPTY_STRING_LIST).map(slug => (
                    <Badge key={`${order.id}-${slug}`} variant="secondary" className="rounded-full text-xs">
                      {catalog.find((module: TenantCatalogModule) => module.slug === slug)?.name ?? slug}
                    </Badge>
                  ))}
                </div>
                {order.payment_channel === "direct_transfer" ? (
                  <div className="mt-4 rounded-2xl border border-border/50 bg-card/40 px-4 py-3 text-xs text-muted-foreground">
                    <p>
                      <span className="font-bold text-foreground">Reference:</span> {order.manual_payment_reference || "Not submitted"}
                    </p>
                    {order.manual_payment_bank_account_snapshot ? (
                      <p className="mt-1">
                        <span className="font-bold text-foreground">Bank:</span> {order.manual_payment_bank_account_snapshot.bank_name} · {order.manual_payment_bank_account_snapshot.account_number}
                      </p>
                    ) : null}
                    <p className="mt-1">
                      <span className="font-bold text-foreground">Review:</span> {String(order.manual_review_status || "pending").replaceAll("_", " ")}
                    </p>
                  </div>
                ) : null}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-foreground">{formatMoney(order.total_amount_etb)}</p>
                  {order.provider_checkout_url && isOrderActive(order.status) && (
                    <Button type="button" variant="outline" size="sm" onClick={() => window.location.assign(order.provider_checkout_url!)} className="rounded-full gap-2">
                      <ExternalLink className="h-4 w-4" /> Resume Checkout
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 6. MODULE SELECTOR ─────────────────────────────────────────── */}
      <div className="rounded-[2rem] border border-border/50 bg-card/40 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-3 border-b border-border/50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-black tracking-tight text-foreground">
              <WandSparkles className="h-5 w-5 text-primary" /> Configure Your Module Stack
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Free modules save instantly. Paid add-ons can go through {paymentProvider?.label ?? "the active payment provider"} or a direct bank transfer when the fallback route is enabled.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest shrink-0">
              {subscriptions?.updated_at ? `Updated ${new Date(subscriptions.updated_at).toLocaleDateString()}` : "Using plan defaults"}
            </Badge>
            {canManage && (
              <Button onClick={handleSave} disabled={saveMutation.isPending || !hasChanges} className="rounded-full px-6 font-semibold gap-2 shadow-sm">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            )}
          </div>
        </div>
        <div className="p-6">
          <ModuleSubscriptionSelector
            catalog={catalog}
            selectedModules={selectedModules}
            customModules={customModules}
            onSelectedModulesChange={setSelectedModules}
            onCustomModulesChange={setCustomModules}
            plan={tenant?.plan}
            disabled={!canManage}
            purchaseLockedModules={canManage}
            onLockedModuleRequest={handleLockedModuleRequest}
            showCustomModules={false}
          />
        </div>
      </div>

      <FeatureAccessMatrix
        matrix={effectiveFeatureMatrix}
        canManage={canManage}
        onModuleRequest={handleMatrixModuleRequest}
      />

      {/* ─── 7. ACTIVE SUMMARY ──────────────────────────────────────────── */}
      <div className="rounded-[2rem] border border-border/50 bg-card/40 p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-lg font-black tracking-tight text-foreground">Active Subscription Summary</h3>
            <p className="mt-1 text-sm text-muted-foreground">Everything your tenant can access right now across the workspace.</p>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
            {activeModuleCount} modules
          </Badge>
        </div>
        <div className="rounded-[1.5rem] border border-border/50 bg-background/70 p-4">
          <ModuleSubscriptionSummary modules={selectedSummaryModules} maxVisible={12} emptyLabel="No modules are active for this tenant yet." />
        </div>
        {subscriptions?.pending_modules?.length ? (
          <div className="mt-4 rounded-[1.5rem] border border-indigo-200 bg-indigo-50/70 dark:bg-indigo-950/30 dark:border-indigo-800/50 p-4 text-sm text-indigo-900 dark:text-indigo-300">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Some module payments are still being processed. They will unlock automatically after the gateway confirms them or a central admin verifies the submitted transfer reference.</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* ─── 8. CHECKOUT DIALOG ─────────────────────────────────────────── */}
      {checkoutModules.length > 0 && (
        <ModuleSubscriptionCheckoutDialog
          open={checkoutModules.length > 0}
          onOpenChange={open => { if (!open) setCheckoutModules([]); }}
          mode={checkoutMode}
          modules={checkoutModules}
          estimatedTotalOverride={checkoutMode === "renewal" ? renewalEstimate : undefined}
          paymentMethods={paymentMethods}
          paymentProvider={paymentProvider}
          directTransfer={directTransfer}
          title={checkoutMode === "renewal" ? "Renew Tenant Subscription" : "Unlock Tenant Modules"}
          description={checkoutMode === "renewal"
            ? `Complete checkout with ${paymentProvider?.label ?? "the active payment provider"} or submit a direct transfer to extend the current tenant subscription window.`
            : `Complete checkout with ${paymentProvider?.label ?? "the active payment provider"} or submit a direct transfer and the selected tenant modules will activate after payment confirmation.`}
          onOrderCreated={() => { queryClient.invalidateQueries({ queryKey: ["tenant-current-subscriptions"] }); }}
        />
      )}
    </div>
  );
}
