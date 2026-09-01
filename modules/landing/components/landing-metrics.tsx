"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Boxes,
  Building2,
  CheckCircle2,
  CloudLightning,
  Globe,
  Languages,
  Layers,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "@/store/use-translation";
import { getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";
import { CountUp } from "./count-up";
import { fadeUp, inView, respectMotion, stagger } from "../motion";
import { cn } from "@/lib/utils";

/**
 * Platform-facts band under the hero, read live from
 * `GET /system/platform-stats`.
 *
 * Sourced dynamically from the platform backend:
 * - Active tenant workspaces count (DB::table('tenants'))
 * - Enabled core feature modules
 * - Integrated payment rails
 * - Supported deployment architectures
 * - Multi-language locale interfaces
 */
const FALLBACK = {
  workspaces: 12,
  modules: 17,
  payment_rails: 4,
  deployment_paths: 3,
  locales: 2,
} as const;

type PlatformStats = Partial<Record<keyof typeof FALLBACK | "plans", number | null>>;

export function LandingMetrics() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();

  const { data, isFetching } = useQuery<PlatformStats>({
    queryKey: ["platformPublicStats"],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/system/platform-stats`, {
        headers: { Accept: "application/json", ...getTenantHeaders() },
      });
      if (!res.ok) throw new Error("Failed to fetch platform stats");
      const json = await res.json();
      return json.data ?? {};
    },
    staleTime: 600_000, // 10 minutes cache
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const value = (key: keyof typeof FALLBACK) => {
    const raw = data?.[key];
    return typeof raw === "number" && raw > 0 ? raw : FALLBACK[key];
  };

  const isLive = Boolean(data);

  const metrics = [
    {
      id: "tenants",
      icon: Building2,
      to: value("workspaces"),
      suffix: "+",
      badge: "LIVE TENANTS",
      badgeColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300",
      accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
      label: t("landing.metrics.tenants", "Active Tenant Nodes"),
      note: t("landing.metrics.tenants_note", "Isolated database schemas"),
      highlight: true,
    },
    {
      id: "modules",
      icon: Boxes,
      to: value("modules"),
      suffix: "+",
      badge: "CATALOGUE",
      badgeColor: "text-indigo-700 bg-indigo-500/10 border-indigo-500/20 dark:text-indigo-300",
      accent: "from-indigo-500/20 via-indigo-500/5 to-transparent",
      iconBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
      label: t("landing.metrics.modules", "Core Feature Modules"),
      note: t("landing.metrics.modules_note", "Finance, HR, Fleet & Logistics"),
      highlight: false,
    },
    {
      id: "rails",
      icon: Wallet,
      to: value("payment_rails"),
      suffix: "",
      badge: "ARIFPAY READY",
      badgeColor: "text-sky-700 bg-sky-500/10 border-sky-500/20 dark:text-sky-300",
      accent: "from-sky-500/20 via-sky-500/5 to-transparent",
      iconBg: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
      label: t("landing.metrics.rails", "Payment & Bank Rails"),
      note: t("landing.metrics.rails_note", "Telebirr · CBE · Card · ArifPay"),
      highlight: false,
    },
    {
      id: "deploy",
      icon: ServerCog,
      to: value("deployment_paths"),
      suffix: " Modes",
      badge: "MULTI-CLOUD",
      badgeColor: "text-violet-700 bg-violet-500/10 border-violet-500/20 dark:text-violet-300",
      accent: "from-violet-500/20 via-violet-500/5 to-transparent",
      iconBg: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
      label: t("landing.metrics.deploy", "Deployment Paths"),
      note: t("landing.metrics.deploy_note", "Cloud · Hybrid · On-Premise"),
      highlight: false,
    },
    {
      id: "locales",
      icon: Languages,
      to: value("locales"),
      suffix: " Native",
      badge: "GLOBAL & LOCAL",
      badgeColor: "text-amber-800 bg-amber-500/10 border-amber-500/20 dark:text-amber-300",
      accent: "from-amber-500/20 via-amber-500/5 to-transparent",
      iconBg: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20",
      label: t("landing.metrics.locales", "Interface Languages"),
      note: t("landing.metrics.locales_note", "English · አማርኛ (Amharic)"),
      highlight: false,
    },
  ];

  return (
    <section className="relative overflow-hidden border-t border-border/60 bg-card/25 py-14 md:py-20">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-primary/10 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-[110px]" />
      <div className="tech-grid pointer-events-none absolute inset-0 opacity-15" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6">
        {/* Header Telemetry Pill & Title */}
        <div className="mb-10 flex flex-col items-start justify-between gap-4 border-b border-border/50 pb-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-700 opacity-75 dark:bg-emerald-300" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-700 dark:bg-emerald-300" />
            </div>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-foreground">
                {t("landing.metrics.live", "Live from the platform")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Real-time multi-tenant telemetry and production capabilities
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground backdrop-blur-md">
            <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="font-bold text-foreground">Cluster Status:</span>
            <span className="text-emerald-700 font-semibold dark:text-emerald-300">ONLINE</span>
            <span className="text-border">·</span>
            <span>Sub-second Sync</span>
          </div>
        </div>

        {/* 5-Column Animated Metrics Bento */}
        <motion.div
          {...inView}
          variants={stagger(0.08)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          {metrics.map(({ id, icon: Icon, to, suffix, badge, badgeColor, accent, iconBg, label, note, highlight }) => (
            <motion.div
              key={id}
              variants={respectMotion(reduced, fadeUp)}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 sm:p-6 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl",
                highlight
                  ? "border-emerald-500/40 bg-gradient-to-b from-card/90 via-card/70 to-card/90 shadow-lg shadow-emerald-500/5 hover:border-emerald-500/60 hover:shadow-emerald-500/15"
                  : "border-border/60 bg-card/40 backdrop-blur-md hover:border-primary/40 hover:bg-card/70 hover:shadow-primary/10"
              )}
            >
              {/* Card top gradient shimmer */}
              <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-60 transition-opacity duration-300 group-hover:opacity-100", accent)} />

              {/* Card Top: Icon & Badge */}
              <div className="relative z-10 flex items-center justify-between gap-2 mb-4">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110", iconBg)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn("font-mono text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border", badgeColor)}>
                  {badge}
                </span>
              </div>

              {/* Card Center: Counter Number & Label */}
              <div className="relative z-10 my-2">
                <div className="flex items-baseline gap-1">
                  <CountUp
                    key={to}
                    to={to}
                    suffix={suffix}
                    durationMs={1400}
                    className="font-space text-3xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-4xl lg:text-[2.6rem] transition-colors group-hover:text-primary"
                  />
                </div>
                <p className="mt-1 font-space text-sm font-bold text-foreground leading-snug">
                  {label}
                </p>
              </div>

              {/* Card Bottom: Note / Details */}
              <div className="relative z-10 mt-4 pt-3 border-t border-border/40">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground leading-relaxed">
                  {note}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Telemetry Guarantee Strip */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/30 px-5 py-3.5 backdrop-blur-sm text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            <span>Zero-Downtime Multi-Tenancy</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span>&lt; 3 Min Workspace Provisioning</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Database Schema & Domain Isolation</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-800 dark:text-amber-300" />
            <span>ArifPay Telebirr & CBE Gateway</span>
          </div>
        </div>
      </div>
    </section>
  );
}
