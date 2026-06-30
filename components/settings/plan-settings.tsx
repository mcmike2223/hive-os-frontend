"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle, Check, ChevronDown, ChevronUp, Crown, HardDrive,
  Layers, Loader2, Lock, RefreshCw, RotateCcw, Save, ShieldCheck,
  Sparkles, ToggleLeft, ToggleRight, Zap, Rocket, Star, Info,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getBackendApiRoot, getAuthHeaders, getWorkspaceScopeKey } from "@/lib/runtime-context";
import { toast } from "sonner";

// ─── Inline API helper (mirrors settings/client.tsx) ─────────────────────────
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getBackendApiRoot()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers: HeadersInit = getAuthHeaders(
    options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}
  );
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'API Request Failed');
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface CatalogModule {
  slug: string;
  name: string;
  description: string;
  category: string;
  tone: string;
  monthly_price_etb: number;
}

interface PlanConfig {
  key: string;
  label: string;
  description: string;
  monthly_price_etb: number;
  storage_mb: number;
  enabled_modules: string[];
  is_disabled: boolean;
  is_free: boolean;
}

interface PlanSettingsData {
  plans: Record<string, PlanConfig>;
  catalog: CatalogModule[];
}

// ─── Plan visual meta ────────────────────────────────────────────────────────
const PLAN_ICONS: Record<string, React.ElementType> = {
  larva: Zap, startup: Rocket, business: Layers, enterprise: Star, overlord: Crown,
};
const PLAN_COLORS: Record<string, string> = {
  larva: "text-slate-500", startup: "text-sky-500", business: "text-indigo-500",
  enterprise: "text-violet-500", overlord: "text-amber-500",
};
const PLAN_BG: Record<string, string> = {
  larva: "bg-slate-500/10", startup: "bg-sky-500/10", business: "bg-indigo-500/10",
  enterprise: "bg-violet-500/10", overlord: "bg-amber-500/10",
};
const PLAN_ORDER = ["larva", "startup", "business", "enterprise", "overlord"];

// ─── Category color map ───────────────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, string> = {
  "Creative Suite":       "bg-rose-500/10 text-rose-500",
  "Communication":        "bg-emerald-500/10 text-emerald-500",
  "Operations":           "bg-amber-500/10 text-amber-500",
  "Security & Compliance":"bg-purple-500/10 text-purple-500",
  "Business Apps":        "bg-blue-500/10 text-blue-500",
  "Developer Tools":      "bg-cyan-500/10 text-cyan-500",
};

// ─── MB → human readable ─────────────────────────────────────────────────────
function fmtStorage(mb: number): string {
  if (mb < 1024) return `${mb} MB`;
  if (mb < 1024 * 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${(mb / 1024 / 1024).toFixed(1)} TB`;
}

// ─── Plan Card ────────────────────────────────────────────────────────────────
function PlanCard({
  plan, catalog, onUpdate, onReset, isSaving,
}: {
  plan: PlanConfig;
  catalog: CatalogModule[];
  onUpdate: (key: string, changes: Partial<PlanConfig>) => void;
  onReset: (key: string) => void;
  isSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(plan.key === "business");
  const Icon = PLAN_ICONS[plan.key] ?? Layers;
  const color = PLAN_COLORS[plan.key] ?? "text-primary";
  const bg = PLAN_BG[plan.key] ?? "bg-primary/10";

  // Group catalog by category
  const byCategory = catalog.reduce<Record<string, CatalogModule[]>>((acc, mod) => {
    const cat = mod.category || "Other";
    (acc[cat] = acc[cat] || []).push(mod);
    return acc;
  }, {});

  const toggleModule = (slug: string) => {
    const current = plan.enabled_modules;
    const next = current.includes(slug)
      ? current.filter(s => s !== slug)
      : [...current, slug];
    onUpdate(plan.key, { enabled_modules: next });
  };

  return (
    <div className={cn(
      "rounded-[2rem] border transition-all duration-300",
      plan.is_disabled
        ? "border-destructive/30 bg-destructive/5 opacity-70"
        : "border-border/50 bg-card/40 backdrop-blur-md"
    )}>
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shrink-0", bg)}>
          <Icon className={cn("h-6 w-6", color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("font-black text-base tracking-tight", color)}>{plan.label}</span>
            {plan.is_disabled && (
              <Badge className="bg-destructive/10 text-destructive border-none text-[10px]">Disabled</Badge>
            )}
            {plan.key === "business" && !plan.is_disabled && (
              <Badge className="bg-indigo-500/10 text-indigo-500 border-none text-[10px]">Popular</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">
              {plan.monthly_price_etb === 0 ? "Free" : `ETB ${plan.monthly_price_etb.toLocaleString()}/mo`}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <HardDrive className="h-3 w-3" /> {fmtStorage(plan.storage_mb)}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3" /> {plan.enabled_modules.length} modules
            </span>
          </div>
        </div>

        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-5 pb-6 space-y-6 border-t border-border/30 pt-5 animate-in slide-in-from-top-2 duration-200">

          {/* Row: Label + Description */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plan Label</Label>
              <Input
                value={plan.label}
                onChange={e => onUpdate(plan.key, { label: e.target.value })}
                className="h-10 bg-muted/30 rounded-xl text-sm font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monthly Price (ETB)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">ETB</span>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={plan.monthly_price_etb}
                  onChange={e => onUpdate(plan.key, { monthly_price_etb: parseFloat(e.target.value) || 0 })}
                  className="h-10 bg-muted/30 rounded-xl text-sm font-mono pl-12"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description (shown on pricing page)</Label>
            <Input
              value={plan.description}
              onChange={e => onUpdate(plan.key, { description: e.target.value })}
              className="h-10 bg-muted/30 rounded-xl text-sm"
              placeholder="Brief tagline shown to tenants on the pricing page…"
            />
          </div>

          {/* Storage */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Storage Quota (MB) = {fmtStorage(plan.storage_mb)}
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={512}
                step={512}
                value={plan.storage_mb}
                onChange={e => onUpdate(plan.key, { storage_mb: parseInt(e.target.value) || 512 })}
                className="h-10 bg-muted/30 rounded-xl text-sm font-mono flex-1"
              />
              {/* Quick presets */}
              <div className="flex gap-1 flex-wrap">
                {[512, 1024, 2048, 10240, 51200, 204800].map(mb => (
                  <button
                    key={mb}
                    type="button"
                    onClick={() => onUpdate(plan.key, { storage_mb: mb })}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold border transition-all",
                      plan.storage_mb === mb
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 border-border hover:bg-muted"
                    )}
                  >
                    {fmtStorage(mb)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Module Checkboxes grouped by category */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Included Modules ({plan.enabled_modules.length} / {catalog.length})
            </Label>
            <div className="space-y-3">
              {Object.entries(byCategory).map(([category, mods]) => (
                <div key={category}>
                  <p className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg mb-2 w-fit", CATEGORY_COLOR[category] ?? "bg-muted/30 text-muted-foreground")}>
                    {category}
                  </p>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {mods.map(mod => {
                      const active = plan.enabled_modules.includes(mod.slug);
                      return (
                        <button
                          key={mod.slug}
                          type="button"
                          onClick={() => toggleModule(mod.slug)}
                          className={cn(
                            "flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all group",
                            active
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/50 bg-muted/20 hover:bg-muted/40"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all",
                            active ? "bg-primary border-primary" : "border-muted-foreground/30 group-hover:border-primary/50"
                          )}>
                            {active && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-xs font-bold leading-tight truncate", active ? "text-foreground" : "text-muted-foreground")}>{mod.name}</p>
                            {mod.monthly_price_etb > 0 && (
                              <p className="text-[10px] text-muted-foreground/70 font-mono">+ETB {mod.monthly_price_etb}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disable toggle + Reset */}
          <div className="flex items-center justify-between pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => onUpdate(plan.key, { is_disabled: !plan.is_disabled })}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all",
                plan.is_disabled
                  ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "border-border/50 bg-muted/20 text-muted-foreground hover:bg-muted/40"
              )}
            >
              {plan.is_disabled ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
              {plan.is_disabled ? "Plan Disabled (click to enable)" : "Plan Enabled (click to disable)"}
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReset(plan.key)}
              disabled={isSaving}
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-xl"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PlanSettings() {
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [localPlans, setLocalPlans] = useState<Record<string, PlanConfig>>({});
  const workspaceScope = getWorkspaceScopeKey();

  const { data, isLoading, error } = useQuery<{ data: PlanSettingsData }>({
    queryKey: ["plan-settings", workspaceScope],
    queryFn: () => apiFetch("/settings/plans"),
    staleTime: 60_000,
  });

  // Initialise local state from server
  useEffect(() => {
    if (data?.data?.plans) {
      setLocalPlans(data.data.plans);
      setDirty(false);
    }
  }, [data]);

  const catalog = data?.data?.catalog ?? [];

  const handleUpdate = useCallback((key: string, changes: Partial<PlanConfig>) => {
    setLocalPlans(prev => ({ ...prev, [key]: { ...prev[key], ...changes } }));
    setDirty(true);
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => apiFetch("/settings/plans", {
      method: "POST",
      body: JSON.stringify({ plans: localPlans }),
    }),
    onSuccess: () => {
      toast.success("Plan configuration saved successfully!");
      queryClient.invalidateQueries({ queryKey: ["plan-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-catalog"] });
      setDirty(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save plan settings.");
    },
  });

  // Reset single plan
  const resetMutation = useMutation({
    mutationFn: (planKey: string) => apiFetch(`/settings/plans/${planKey}/reset`, { method: "POST" }),
    onSuccess: (_, planKey) => {
      toast.success(`Plan "${planKey}" reset to catalog defaults.`);
      queryClient.invalidateQueries({ queryKey: ["plan-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-catalog"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Reset failed.");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs font-mono">
          Could not load plan settings. Make sure you are on the Central node.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Subscription Plan Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Set pricing, storage quotas, and included modules for each plan. Changes here affect the public pricing page and tenant signup flow immediately after saving.
          </p>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className={cn(
            "rounded-full gap-2 font-bold shadow-lg transition-all",
            dirty ? "shadow-primary/20" : ""
          )}
        >
          {saveMutation.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
            : <><Save className="h-4 w-4" />Save All Plans</>}
        </Button>
      </div>

      {/* Unsaved changes banner */}
      {dirty && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-amber-600 dark:text-amber-400 animate-in slide-in-from-top-2">
          <Info className="h-4 w-4 shrink-0" />
          <p className="text-sm font-bold">You have unsaved changes — click <em>Save All Plans</em> to apply.</p>
        </div>
      )}

      {/* Info strip */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: HardDrive, color: "text-sky-500", bg: "bg-sky-500/10", title: "Storage Quotas", desc: "Set per-plan MB limits. Tenants' mailboxes, file managers, and media libraries all share this quota." },
          { icon: Layers, color: "text-indigo-500", bg: "bg-indigo-500/10", title: "Module Bundles", desc: "Toggle which modules are included by default. Tenants can still add-on extra modules via checkout." },
          { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-500/10", title: "Plan Visibility", desc: "Disable a plan to hide it from the public pricing page and signup flow without deleting anything." },
        ].map(item => (
          <div key={item.title} className="rounded-2xl border border-border/50 bg-card/40 p-4 flex gap-3">
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
              <item.icon className={cn("h-4 w-4", item.color)} />
            </div>
            <div>
              <p className="text-xs font-black text-foreground mb-0.5">{item.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div className="space-y-4">
        {PLAN_ORDER.map(key => {
          const plan = localPlans[key];
          if (!plan) return null;
          return (
            <PlanCard
              key={key}
              plan={plan}
              catalog={catalog}
              onUpdate={handleUpdate}
              onReset={k => resetMutation.mutate(k)}
              isSaving={saveMutation.isPending || resetMutation.isPending}
            />
          );
        })}
      </div>

      {/* Save button (bottom) */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="rounded-full px-8 gap-2 font-bold shadow-lg shadow-primary/20"
          size="lg"
        >
          {saveMutation.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
            : <><Save className="h-4 w-4" />Save All Plans</>}
        </Button>
      </div>
    </div>
  );
}
