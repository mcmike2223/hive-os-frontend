import { Activity, BarChart3, BookOpenCheck, ClipboardCheck, Goal, LayoutDashboard, MessageSquareText, UsersRound } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = { moduleId: "performance" as const, subscriptionSlug: "performance_management", placement: "primary" as const };

export const performanceModule: FrontendModuleDefinition = {
  id: "performance",
  name: "Performance Management",
  description: "Employee goals, reviews, feedback, calibration, development plans, and people analytics.",
  backendModule: "Modules\\PerformanceManagement",
  routePrefixes: ["/dashboard/performance"],
  navItems: [
    { ...common, translationKey: "nav.performance_overview", fallbackLabel: "Performance Overview", href: "/dashboard/performance", icon: LayoutDashboard, permissions: ["view_own_performance", "view_team_performance", "view_all_performance", "manage_performance"], tourId: "tour-nav-performance" },
    { ...common, translationKey: "nav.performance_cycles", fallbackLabel: "Review Cycles", href: "/dashboard/performance/cycles", icon: Activity, permissions: ["manage_performance_cycles", "manage_performance"] },
    { ...common, translationKey: "nav.performance_goals", fallbackLabel: "Goals & OKRs", href: "/dashboard/performance/goals", icon: Goal, permissions: ["view_own_performance", "manage_own_goals", "manage_team_goals", "manage_performance"] },
    { ...common, translationKey: "nav.performance_reviews", fallbackLabel: "Performance Reviews", href: "/dashboard/performance/reviews", icon: ClipboardCheck, permissions: ["submit_self_reviews", "conduct_performance_reviews", "view_own_performance", "view_team_performance", "manage_performance"] },
    { ...common, translationKey: "nav.performance_team", fallbackLabel: "Team Performance", href: "/dashboard/performance/team", icon: UsersRound, permissions: ["view_team_performance", "view_all_performance", "conduct_performance_reviews", "manage_performance"] },
    { ...common, translationKey: "nav.performance_development", fallbackLabel: "Feedback & Development", href: "/dashboard/performance/development", icon: MessageSquareText, permissions: ["request_performance_feedback", "provide_performance_feedback", "manage_performance_checkins", "manage_improvement_plans", "manage_performance"] },
    { ...common, translationKey: "nav.performance_reports", fallbackLabel: "Performance Reports", href: "/dashboard/performance/reports", icon: BarChart3, permissions: ["view_performance_reports", "export_performance_reports", "view_all_performance", "manage_performance"] },
    { ...common, translationKey: "nav.performance_settings", fallbackLabel: "Competencies & Settings", href: "/dashboard/performance/settings", icon: BookOpenCheck, permissions: ["manage_competencies", "manage_performance_cycles", "manage_performance"] },
  ],
};

