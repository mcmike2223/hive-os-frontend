import { ShieldCheck, FileWarning, ClipboardList, Layers, TriangleAlert } from "lucide-react";
import type { FrontendModuleDefinition } from "@/modules/types";

const common = {
  moduleId: "internal-audit" as const,
  subscriptionSlug: "internal_audit",
  placement: "primary" as const,
};

export const internalAuditModule: FrontendModuleDefinition = {
  id: "internal-audit",
  name: "Internal Audit",
  description:
    "The internal audit function: a risk-ranked audit universe, engagements and working papers, findings with the five elements, agreed management actions tracked to a date, independent verification that fixes held, and a risk register.",
  backendModule: "Modules\\InternalAudit",
  routePrefixes: ["/dashboard/internal-audit"],
  navItems: [
    {
      ...common,
      translationKey: "nav.internal_audit_overview",
      fallbackLabel: "Internal Audit",
      href: "/dashboard/internal-audit",
      icon: ShieldCheck,
      permissions: ["view_internal_audit", "manage_internal_audit"],
    },
    {
      ...common,
      translationKey: "nav.internal_audit_findings",
      fallbackLabel: "Findings & Actions",
      href: "/dashboard/internal-audit/findings",
      icon: FileWarning,
      permissions: [
        "view_internal_audit",
        "manage_audit_findings",
        "manage_audit_actions",
        "manage_internal_audit",
      ],
    },
    {
      ...common,
      translationKey: "nav.internal_audit_engagements",
      fallbackLabel: "Engagements",
      href: "/dashboard/internal-audit/engagements",
      icon: ClipboardList,
      permissions: [
        "view_internal_audit",
        "manage_audit_engagements",
        "manage_audit_procedures",
        "manage_internal_audit",
      ],
    },
    {
      ...common,
      translationKey: "nav.internal_audit_universe",
      fallbackLabel: "Audit Universe",
      href: "/dashboard/internal-audit/universe",
      icon: Layers,
      permissions: ["view_internal_audit", "manage_audit_universe", "manage_internal_audit"],
      placement: "secondary",
    },
    {
      ...common,
      translationKey: "nav.internal_audit_risks",
      fallbackLabel: "Risk Register",
      href: "/dashboard/internal-audit/risks",
      icon: TriangleAlert,
      permissions: ["view_internal_audit", "manage_audit_risks", "manage_internal_audit"],
      placement: "secondary",
    },
  ],
};
