import { Telescope, Sigma, Database, BellRing } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "vantage" as const,
  subscriptionSlug: "vantage_bi",
  placement: "primary" as const,
};

export const vantageModule: FrontendModuleDefinition = {
  id: "vantage",
  name: "Vantage — Business Intelligence",
  description:
    "Reporting across every installed module: a guarded dataset registry, safe metric definitions, dashboards you assemble yourself, month-end snapshots that keep what was reported at the time, and threshold alerts. Sources belonging to modules you have not subscribed to report as unavailable rather than as zero.",
  backendModule: "Modules\\Vantage",
  routePrefixes: ["/dashboard/vantage"],
  navItems: [
    {
      ...common,
      translationKey: "nav.vantage_overview",
      fallbackLabel: "Vantage",
      href: "/dashboard/vantage",
      icon: Telescope,
      permissions: ["view_vantage", "manage_vantage"],
    },
    {
      ...common,
      translationKey: "nav.vantage_metrics",
      fallbackLabel: "Metrics",
      href: "/dashboard/vantage/metrics",
      icon: Sigma,
      permissions: ["view_vantage", "manage_vantage_metrics", "manage_vantage"],
    },
    {
      ...common,
      translationKey: "nav.vantage_sources",
      fallbackLabel: "Data Sources",
      href: "/dashboard/vantage/sources",
      icon: Database,
      permissions: ["view_vantage", "manage_vantage_metrics", "manage_vantage"],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.vantage_alerts",
      fallbackLabel: "Alerts",
      href: "/dashboard/vantage/alerts",
      icon: BellRing,
      permissions: ["view_vantage", "manage_vantage_alerts", "manage_vantage"],
      placement: "secondary",
    },
  ],
};
