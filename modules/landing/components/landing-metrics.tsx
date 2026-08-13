"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Boxes, Languages, ServerCog, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "@/store/use-translation";
import { getBackendApiRoot, getTenantHeaders } from "@/lib/runtime-context";
import { CountUp } from "./count-up";
import { fadeUp, inView, respectMotion, stagger } from "../motion";

/**
 * Platform-facts band under the hero, read live from
 * `GET /system/platform-stats`.
 *
 * The endpoint returns aggregates about the *platform* — module count, active
 * workspaces, plans, locales — and deliberately never customer business data
 * (revenue, headcount, order volume). It is unauthenticated, so anything it
 * returned would be world-readable.
 *
 * Any field can come back null when its table is empty or mid-migration. The
 * constants below are the documented fallbacks so the band degrades to slightly
 * stale copy rather than announcing "0 modules".
 */
const FALLBACK = {
  modules: 15,
  payment_rails: 4,
  deployment_paths: 3,
  locales: 2,
} as const;

type PlatformStats = Partial<Record<keyof typeof FALLBACK | "workspaces" | "plans", number | null>>;

export function LandingMetrics() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();

  const { data } = useQuery<PlatformStats>({
    queryKey: ["platformPublicStats"],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/system/platform-stats`, {
        headers: { Accept: "application/json", ...getTenantHeaders() },
      });
      if (!res.ok) throw new Error("Failed to fetch platform stats");
      const json = await res.json();
      return json.data ?? {};
    },
    staleTime: 900_000, // matches the 15-minute server-side cache
    retry: 1,
  });

  const value = (key: keyof typeof FALLBACK) => data?.[key] ?? FALLBACK[key];
  const isLive = Boolean(data);

  const metrics = [
    {
      icon: Boxes,
      to: value("modules"),
      label: t("landing.metrics.modules", "Modules in the catalogue"),
      note: t("landing.metrics.modules_note", "Enabled per workspace"),
    },
    {
      icon: Wallet,
      to: value("payment_rails"),
      label: t("landing.metrics.rails", "Local payment & bank rails"),
      note: t("landing.metrics.rails_note", "Telebirr · CBE · Chapa · ArifPay"),
    },
    {
      icon: ServerCog,
      to: value("deployment_paths"),
      label: t("landing.metrics.deploy", "Deployment paths"),
      note: t("landing.metrics.deploy_note", "Cloud · Hybrid · On-premise"),
    },
    {
      icon: Languages,
      to: value("locales"),
      label: t("landing.metrics.locales", "Interface languages"),
      note: t("landing.metrics.locales_note", "English · አማርኛ"),
    },
  ];

  return (
    <section className="relative border-t border-border/60 bg-card/20 py-14 md:py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {isLive && (
          <p className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            {t("landing.metrics.live", "Live from the platform")}
          </p>
        )}

        <motion.div
          {...inView}
          variants={stagger(0.09)}
          className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4"
        >
          {metrics.map(({ icon: Icon, to, label, note }) => (
            <motion.div
              key={label}
              variants={respectMotion(reduced, fadeUp)}
              className="group flex flex-col items-center gap-1.5 text-center lg:items-start lg:text-left"
            >
              <Icon className="mb-1 h-5 w-5 text-primary/60 transition-colors group-hover:text-primary" />
              <CountUp
                // Keyed on the value so the number re-counts if the fetch
                // resolves after the band has already scrolled into view.
                key={to}
                to={to}
                className="font-space text-4xl font-bold tabular-nums tracking-tight md:text-5xl"
              />
              <p className="font-space text-sm font-bold text-foreground">{label}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {note}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
