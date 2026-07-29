import { BarChart3, WalletCards } from "lucide-react";

import type { FrontendModuleDefinition } from "@/modules/types";

export const payrollModule: FrontendModuleDefinition = {
  id: "payroll",
  name: "Payroll Management",
  description:
    "Work entries, reconciliation, earnings, deductions, locked periods, adjustments, and payslips.",
  backendModule: "Modules\\Payroll",
  routePrefixes: ["/dashboard/payroll", "/dashboard/payroll/reports"],
  navItems: [
    {
      moduleId: "payroll",
      translationKey: "nav.payroll",
      fallbackLabel: "Payroll Management",
      href: "/dashboard/payroll",
      icon: WalletCards,
      subscriptionSlug: ["payroll_management", "human_resources"],
      permissions: [
        "view_payroll",
        "manage_payroll",
        "view_payroll_attendance",
        "manage_payroll_attendance",
      ],
      placement: "primary",
    },
    {
      moduleId: "payroll",
      translationKey: "nav.payroll_reports",
      fallbackLabel: "Payroll Reports",
      href: "/dashboard/payroll/reports",
      icon: BarChart3,
      subscriptionSlug: ["payroll_management", "human_resources"],
      permissions: [
        "view_workforce_reports",
        "view_payroll",
        "view_payroll_attendance",
        "manage_payroll",
      ],
      placement: "primary",
    },
  ],
};
