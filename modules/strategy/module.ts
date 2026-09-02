import { Compass, Grid2x2, Gauge, Rocket, CalendarCheck } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "strategy" as const,
  subscriptionSlug: "strategic_planning",
  placement: "primary" as const,
};

export const strategyModule: FrontendModuleDefinition = {
  id: "strategy",
  name: "Strategic Planning",
  description:
    "Balanced-scorecard strategy: plans and perspectives, cascaded objectives, KPIs that know whether higher or lower is better and are measured from a baseline, initiatives tracked against budget, and a weighted roll-up to one plan score set against how much of the plan has elapsed.",
  backendModule: "Modules\\StrategicPlanning",
  routePrefixes: ["/dashboard/strategy"],
  navItems: [
    {
      ...common,
      translationKey: "nav.strategy_overview",
      fallbackLabel: "Strategy",
      href: "/dashboard/strategy",
      icon: Compass,
      permissions: ["view_strategy", "manage_strategy"],
    },
    {
      ...common,
      translationKey: "nav.strategy_scorecard",
      fallbackLabel: "Scorecard",
      href: "/dashboard/strategy/scorecard",
      icon: Grid2x2,
      permissions: ["view_strategy", "manage_strategy"],
    },
    {
      ...common,
      translationKey: "nav.strategy_kpis",
      fallbackLabel: "KPIs",
      href: "/dashboard/strategy/kpis",
      icon: Gauge,
      permissions: [
        "view_strategy",
        "manage_strategy_kpis",
        "record_strategy_readings",
        "manage_strategy",
      ],
    },
    {
      ...common,
      translationKey: "nav.strategy_initiatives",
      fallbackLabel: "Initiatives",
      href: "/dashboard/strategy/initiatives",
      icon: Rocket,
      permissions: ["view_strategy", "manage_strategy_initiatives", "manage_strategy"],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.strategy_reviews",
      fallbackLabel: "Plans & Reviews",
      href: "/dashboard/strategy/reviews",
      icon: CalendarCheck,
      permissions: [
        "view_strategy",
        "manage_strategy_plans",
        "manage_strategy_reviews",
        "manage_strategy",
      ],
      placement: "secondary",
    },
  ],
};
